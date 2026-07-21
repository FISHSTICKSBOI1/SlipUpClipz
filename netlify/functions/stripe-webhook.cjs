const {
  findAffiliate,
  calculateCommissionCents,
  getCommissionEligibleAt,
} = require('../lib/affiliates.cjs')
const { getStripe, jsonResponse, mapSubscriptionStatus } = require('../lib/commerce.cjs')
const { sendLicenseEmail } = require('../lib/email.cjs')
const { claimStripeEvent, completeStripeEvent, failStripeEvent } = require('../lib/idempotency.cjs')
const { generateUniqueLicenseKey } = require('../lib/license.cjs')
const { maybeApprovePendingAffiliateCommission } = require('../lib/affiliate-commissions.cjs')
const {
  getCommissionableCentsFromCheckoutSession,
  getCommissionableCentsFromInvoice,
  getRefundCommissionAdjustmentCents,
} = require('../lib/payments.cjs')
const {
  connectCommerceBlobs,
  licenseExists,
  saveLicenseRecord,
  getLicenseBySubscriptionId,
  getLicenseByChargeId,
  getLicenseByPaymentIntentId,
  recordAffiliateCommission,
} = require('../lib/storage.cjs')

function normalizeSecret(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
}

function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return undefined
  const target = String(name).toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() !== target) continue
    if (Array.isArray(value)) return value[0]
    return value
  }
  return undefined
}

function getRawBody(event) {
  if (event == null) return ''

  // Some Netlify runtimes expose an unmodified raw body separately.
  if (typeof event.rawBody === 'string' && event.rawBody.length > 0) {
    return event.rawBody
  }

  if (event.body == null || event.body === '') return ''

  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf8')
  }

  if (typeof event.body === 'string') {
    return event.body
  }

  // Parsed objects cannot be signature-verified reliably.
  console.error('[stripe-webhook] Request body was parsed; Stripe requires the raw body string')
  return JSON.stringify(event.body)
}

async function getExpandedCheckoutSession(stripe, sessionId) {
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription.latest_invoice.charge', 'payment_intent.latest_charge'],
  })
}

function getChargeIdFromSession(session) {
  const invoiceCharge = session.subscription?.latest_invoice?.charge
  if (typeof invoiceCharge === 'string') return invoiceCharge
  if (invoiceCharge?.id) return invoiceCharge.id

  const paymentIntentCharge = session.payment_intent?.latest_charge
  if (typeof paymentIntentCharge === 'string') return paymentIntentCharge
  if (paymentIntentCharge?.id) return paymentIntentCharge.id

  return null
}

function getPaymentIntentIdFromSession(session) {
  if (typeof session.payment_intent === 'string') return session.payment_intent
  return session.payment_intent?.id || null
}

async function handleCheckoutCompleted(stripe, session) {
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

  if (!subscriptionId) {
    throw new Error(`Checkout session ${session.id} is missing subscription id`)
  }

  const existingBySub = await getLicenseBySubscriptionId(subscriptionId)
  if (existingBySub?.licenseKey) {
    return { skipped: true, reason: 'license-already-issued', licenseKey: existingBySub.licenseKey }
  }

  const fullSession = await getExpandedCheckoutSession(stripe, session.id)
  const email =
    fullSession.customer_details?.email ||
    fullSession.customer_email ||
    (typeof fullSession.customer === 'object' ? fullSession.customer?.email : null)

  if (!email) {
    throw new Error(`Checkout session ${session.id} is missing customer email`)
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id

  const affiliateCode =
    fullSession.metadata?.affiliateCode || subscription.metadata?.affiliateCode || ''
  const affiliate = affiliateCode ? findAffiliate(affiliateCode) : null
  const commissionableCents = getCommissionableCentsFromCheckoutSession(fullSession)
  const purchaseDate = new Date().toISOString()
  const chargeId = getChargeIdFromSession(fullSession)
  const paymentIntentId = getPaymentIntentIdFromSession(fullSession)

  let affiliateCommission = null
  if (affiliate && commissionableCents > 0) {
    const commissionAmountCents = calculateCommissionCents(
      commissionableCents,
      affiliate.commissionPercent,
    )

    affiliateCommission = {
      id: `${fullSession.id}:first-purchase`,
      affiliateCode: affiliate.code,
      creatorName: affiliate.creatorName,
      commissionPercent: affiliate.commissionPercent,
      commissionableCents,
      commissionAmountCents,
      taxExcluded: true,
      firstPurchaseOnly: true,
      status: 'pending',
      eligibleAt: getCommissionEligibleAt(purchaseDate),
      stripeCheckoutSessionId: fullSession.id,
      stripeChargeId: chargeId,
      createdAt: purchaseDate,
    }

    await recordAffiliateCommission(affiliate.code, {
      id: affiliateCommission.id,
      stripeCustomerId: customerId,
      commissionableCents,
      commissionAmountCents,
      status: 'pending',
      eligibleAt: affiliateCommission.eligibleAt,
    })
  }

  const licenseKey = await generateUniqueLicenseKey(async (key) => licenseExists(key))

  const record = {
    licenseKey,
    email,
    purchaseDate,
    affiliateCode: affiliate?.code || null,
    creatorName: affiliate?.creatorName || null,
    firstPurchaseCommissionableCents: commissionableCents,
    affiliateCommission,
    amountPaidCents: fullSession.amount_total ?? 0,
    stripePaymentId: paymentIntentId || fullSession.id,
    stripePaymentIntentId: paymentIntentId,
    stripeLatestChargeId: chargeId,
    stripeCheckoutSessionId: fullSession.id,
    stripeCustomerId: customerId || null,
    stripeSubscriptionId: subscriptionId,
    product: 'SlipUpClipz Pro',
    status: mapSubscriptionStatus(subscription.status),
    expiresAt: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    emailSent: false,
    renewals: [],
  }

  await saveLicenseRecord(record)

  if (!record.emailSent) {
    await sendLicenseEmail({ to: email, licenseKey })
    record.emailSent = true
    record.emailSentAt = new Date().toISOString()
    await saveLicenseRecord(record)
  }

  return { licenseKey, emailSent: true }
}

async function handleInvoicePaymentSucceeded(stripe, invoice) {
  if (invoice.billing_reason !== 'subscription_cycle') {
    return { skipped: true, reason: 'not-renewal' }
  }

  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id

  if (!subscriptionId) {
    return { skipped: true, reason: 'missing-subscription' }
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const existing = await getLicenseBySubscriptionId(subscriptionId)

  if (!existing) {
    console.warn(`Renewal received for unknown subscription ${subscriptionId}`)
    return { skipped: true, reason: 'unknown-subscription' }
  }

  const renewal = {
    date: new Date().toISOString(),
    amountPaidCents: invoice.amount_paid ?? 0,
    commissionableCents: getCommissionableCentsFromInvoice(invoice),
    stripeInvoiceId: invoice.id,
  }

  const updated = {
    ...existing,
    status: mapSubscriptionStatus(subscription.status),
    expiresAt: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : existing.expiresAt,
    renewals: [...(existing.renewals || []), renewal],
  }

  const approved = await maybeApprovePendingAffiliateCommission(updated)
  await saveLicenseRecord(approved)

  return { licenseKey: existing.licenseKey, renewal: true }
}

async function handleInvoicePaymentFailed(_stripe, invoice) {
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id

  if (!subscriptionId) {
    return { skipped: true, reason: 'missing-subscription' }
  }

  const existing = await getLicenseBySubscriptionId(subscriptionId)
  if (!existing) {
    return { skipped: true, reason: 'unknown-subscription' }
  }

  const updated = {
    ...existing,
    status: 'past_due',
    lastPaymentFailedAt: new Date().toISOString(),
    stripeLatestInvoiceId: invoice.id,
  }

  await saveLicenseRecord(updated)
  return { licenseKey: existing.licenseKey, status: 'past_due' }
}

async function handleSubscriptionUpdated(subscription) {
  const existing = await getLicenseBySubscriptionId(subscription.id)
  if (!existing) {
    return { skipped: true, reason: 'unknown-subscription' }
  }

  const updated = {
    ...existing,
    status: mapSubscriptionStatus(subscription.status),
    expiresAt: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : existing.expiresAt,
  }

  const approved = await maybeApprovePendingAffiliateCommission(updated)
  await saveLicenseRecord(approved)

  return { licenseKey: existing.licenseKey, status: approved.status }
}

async function resolveLicenseFromCharge(stripe, charge) {
  let license =
    (charge.id ? await getLicenseByChargeId(charge.id) : null) ||
    (charge.payment_intent ? await getLicenseByPaymentIntentId(charge.payment_intent) : null)

  if (license || !charge.payment_intent) {
    return license
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent)
  const invoiceId =
    typeof paymentIntent.invoice === 'string' ? paymentIntent.invoice : paymentIntent.invoice?.id

  if (!invoiceId) {
    return null
  }

  const invoice = await stripe.invoices.retrieve(invoiceId)
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id

  if (!subscriptionId) {
    return null
  }

  return getLicenseBySubscriptionId(subscriptionId)
}

async function revokeAffiliateCommissionForLicense(license, revokeCents, nextStatus) {
  if (!license.affiliateCommission || !license.affiliateCode || revokeCents <= 0) {
    return license.affiliateCommission
  }

  const { revokeAffiliateCommissionAmount } = require('../lib/affiliate-commissions.cjs')
  await revokeAffiliateCommissionAmount(license.affiliateCode, license.affiliateCommission, revokeCents)

  return {
    ...license.affiliateCommission,
    status: nextStatus,
    revokedCents: (license.affiliateCommission.revokedCents || 0) + revokeCents,
    revokedAt: new Date().toISOString(),
  }
}

async function handleChargeRefunded(stripe, charge) {
  const license = await resolveLicenseFromCharge(stripe, charge)
  if (!license) {
    return { skipped: true, reason: 'unknown-charge' }
  }

  const refundedCents = charge.amount_refunded ?? 0
  const commissionableCents = license.firstPurchaseCommissionableCents ?? 0
  const commissionCents = license.affiliateCommission?.commissionAmountCents ?? 0
  const revokeCents = getRefundCommissionAdjustmentCents(
    refundedCents,
    commissionableCents,
    commissionCents,
  )

  const isFullRefund = refundedCents >= (charge.amount ?? 0)
  const nextCommission = await revokeAffiliateCommissionForLicense(
    license,
    revokeCents,
    isFullRefund ? 'revoked' : license.affiliateCommission?.status || 'pending',
  )

  const updated = {
    ...license,
    status: isFullRefund ? 'refunded' : license.status,
    refundedCents: (license.refundedCents || 0) + refundedCents,
    affiliateCommission: nextCommission,
    lastRefundAt: new Date().toISOString(),
  }

  await saveLicenseRecord(updated)
  return { licenseKey: license.licenseKey, refundedCents, isFullRefund }
}

async function handleDisputeCreated(stripe, dispute) {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
  if (!chargeId) {
    return { skipped: true, reason: 'missing-charge' }
  }

  const charge = await stripe.charges.retrieve(chargeId)
  const license = await resolveLicenseFromCharge(stripe, charge)
  if (!license) {
    return { skipped: true, reason: 'unknown-charge' }
  }

  const commissionCents = license.affiliateCommission?.commissionAmountCents ?? 0
  const nextCommission = await revokeAffiliateCommissionForLicense(
    license,
    commissionCents,
    'revoked',
  )

  const updated = {
    ...license,
    status: 'disputed',
    affiliateCommission: nextCommission,
    disputeId: dispute.id,
    disputedAt: new Date().toISOString(),
  }

  await saveLicenseRecord(updated)
  return { licenseKey: license.licenseKey, disputeId: dispute.id }
}

async function handleDisputeClosed(stripe, dispute) {
  if (dispute.status === 'won') {
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
    if (!chargeId) return { skipped: true, reason: 'missing-charge' }

    const charge = await stripe.charges.retrieve(chargeId)
    const license = await resolveLicenseFromCharge(stripe, charge)
    if (!license) return { skipped: true, reason: 'unknown-charge' }

    let nextStatus = 'active'
    if (license.stripeSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(license.stripeSubscriptionId)
      nextStatus = mapSubscriptionStatus(subscription.status)
    }

    const updated = {
      ...license,
      status: nextStatus,
      disputeClosedAt: new Date().toISOString(),
      disputeStatus: dispute.status,
    }

    await saveLicenseRecord(updated)
    return { licenseKey: license.licenseKey, disputeStatus: dispute.status }
  }

  return { skipped: true, reason: 'dispute-lost-or-unhandled' }
}

exports.handler = async (event) => {
  connectCommerceBlobs(event)

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const webhookSecret = normalizeSecret(process.env.STRIPE_WEBHOOK_SECRET)
  if (!webhookSecret) {
    return jsonResponse(503, { error: 'Webhook secret is not configured' })
  }

  const stripe = getStripe()
  const headers = event.headers || {}
  const signature =
    getHeader(headers, 'stripe-signature') ||
    getHeader(event.multiValueHeaders || {}, 'stripe-signature')
  const rawBody = getRawBody(event)

  if (!signature) {
    console.error('[stripe-webhook] Missing stripe-signature header', {
      headerKeys: Object.keys(headers),
      multiValueHeaderKeys: Object.keys(event.multiValueHeaders || {}),
    })
    return jsonResponse(400, { error: 'Invalid webhook signature' })
  }

  if (!rawBody) {
    console.error('[stripe-webhook] Empty request body for signature verification', {
      isBase64Encoded: Boolean(event.isBase64Encoded),
      bodyType: typeof event.body,
    })
    return jsonResponse(400, { error: 'Invalid webhook signature' })
  }

  let stripeEvent
  try {
    // Stripe requires the exact raw request body bytes + endpoint signing secret.
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    console.error('[stripe-webhook] Signature verification failed', {
      message: error instanceof Error ? error.message : String(error),
      bodyType: typeof event.body,
      isBase64Encoded: Boolean(event.isBase64Encoded),
      bodyLength: typeof rawBody === 'string' ? rawBody.length : 0,
      secretPrefix: webhookSecret.slice(0, 6),
    })
    return jsonResponse(400, { error: 'Invalid webhook signature' })
  }

  const claim = await claimStripeEvent(stripeEvent.id, stripeEvent.type)
  if (!claim.claimed) {
    return jsonResponse(200, { received: true, duplicate: true, reason: claim.reason })
  }

  try {
    let result = { handled: stripeEvent.type }

    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        result = await handleCheckoutCompleted(stripe, stripeEvent.data.object)
        break
      case 'invoice.payment_succeeded':
        result = await handleInvoicePaymentSucceeded(stripe, stripeEvent.data.object)
        break
      case 'invoice.payment_failed':
        result = await handleInvoicePaymentFailed(stripe, stripeEvent.data.object)
        break
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        result = await handleSubscriptionUpdated(stripeEvent.data.object)
        break
      case 'charge.refunded':
        result = await handleChargeRefunded(stripe, stripeEvent.data.object)
        break
      case 'charge.dispute.created':
        result = await handleDisputeCreated(stripe, stripeEvent.data.object)
        break
      case 'charge.dispute.closed':
        result = await handleDisputeClosed(stripe, stripeEvent.data.object)
        break
      default:
        result = { skipped: true, reason: 'ignored-event-type' }
        break
    }

    await completeStripeEvent(stripeEvent.id, result)
    return jsonResponse(200, { received: true })
  } catch (error) {
    console.error(`Webhook handler failed for ${stripeEvent.type}`, error)
    await failStripeEvent(stripeEvent.id, error)
    return jsonResponse(500, { error: 'Webhook handler failed' })
  }
}
