function getSiteUrl() {
  return process.env.SITE_URL || 'https://slipupclipz.com'
}

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  const Stripe = require('stripe')
  return new Stripe(secretKey)
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  }
}

function mapSubscriptionStatus(stripeStatus) {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    case 'incomplete':
    case 'incomplete_expired':
      return 'expired'
    default:
      return stripeStatus
  }
}

module.exports = {
  getSiteUrl,
  getStripe,
  jsonResponse,
  mapSubscriptionStatus,
}
