/**
 * Payment amount helpers.
 * Commission is based on the amount actually paid excluding tax.
 */

function getTaxCentsFromCheckoutSession(session) {
  return session.total_details?.amount_tax ?? 0
}

function getCommissionableCentsFromCheckoutSession(session) {
  const amountTotal = session.amount_total ?? 0
  const tax = getTaxCentsFromCheckoutSession(session)
  return Math.max(0, amountTotal - tax)
}

function getTaxCentsFromInvoice(invoice) {
  if (typeof invoice.tax === 'number') {
    return invoice.tax
  }

  if (Array.isArray(invoice.total_tax_amounts)) {
    return invoice.total_tax_amounts.reduce((sum, entry) => sum + (entry.amount || 0), 0)
  }

  return 0
}

function getCommissionableCentsFromInvoice(invoice) {
  const amountPaid = invoice.amount_paid ?? 0
  const tax = getTaxCentsFromInvoice(invoice)
  return Math.max(0, amountPaid - tax)
}

function getRefundCommissionAdjustmentCents(refundedCents, commissionableCents, commissionCents) {
  if (!commissionableCents || commissionableCents <= 0 || !commissionCents || commissionCents <= 0) {
    return 0
  }

  const ratio = Math.min(1, refundedCents / commissionableCents)
  return Math.round(commissionCents * ratio)
}

module.exports = {
  getCommissionableCentsFromCheckoutSession,
  getCommissionableCentsFromInvoice,
  getTaxCentsFromCheckoutSession,
  getTaxCentsFromInvoice,
  getRefundCommissionAdjustmentCents,
}
