const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const AFFILIATES_PATH = join(__dirname, '../data/affiliates.json')
const DEFAULT_REFUND_WINDOW_DAYS = 14
const DEFAULT_COMMISSION_PERCENT = 25
const DEFAULT_CUSTOMER_DISCOUNT_PERCENT = 25

/** @typedef {{ code: string, creatorName: string, commissionPercent: number, customerDiscountPercent: number, stripeCouponId?: string, active: boolean }} AffiliateConfig */

function loadAffiliateConfig() {
  try {
    const raw = JSON.parse(readFileSync(AFFILIATES_PATH, 'utf8'))
    return Array.isArray(raw.affiliates) ? raw.affiliates : []
  } catch {
    return []
  }
}

/** @returns {AffiliateConfig | null} */
function findAffiliate(code) {
  if (!code || typeof code !== 'string') return null

  const normalized = code.trim().toUpperCase()
  if (!normalized) return null

  const affiliate = loadAffiliateConfig().find(
    (entry) => entry.active && entry.code.trim().toUpperCase() === normalized,
  )

  return affiliate || null
}

function resolveAffiliateCouponId(affiliate) {
  if (!affiliate) return null

  const couponId = affiliate.stripeCouponId?.trim()
  if (couponId) return couponId

  const fallback = process.env.STRIPE_AFFILIATE_COUPON_ID?.trim()
  return fallback || null
}

function getRefundWindowDays() {
  const parsed = Number.parseInt(process.env.REFUND_WINDOW_DAYS || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REFUND_WINDOW_DAYS
}

function getCommissionEligibleAt(purchaseDateIso) {
  const eligibleAt = new Date(purchaseDateIso)
  eligibleAt.setUTCDate(eligibleAt.getUTCDate() + getRefundWindowDays())
  return eligibleAt.toISOString()
}

function calculateCommissionCents(commissionableCents, commissionPercent) {
  if (!Number.isFinite(commissionableCents) || commissionableCents <= 0) return 0
  if (!Number.isFinite(commissionPercent) || commissionPercent <= 0) return 0

  return Math.round((commissionableCents * commissionPercent) / 100)
}

function getDefaultCommissionPercent(affiliate) {
  return affiliate?.commissionPercent ?? DEFAULT_COMMISSION_PERCENT
}

function getDefaultCustomerDiscountPercent(affiliate) {
  return affiliate?.customerDiscountPercent ?? DEFAULT_CUSTOMER_DISCOUNT_PERCENT
}

module.exports = {
  loadAffiliateConfig,
  findAffiliate,
  resolveAffiliateCouponId,
  getRefundWindowDays,
  getCommissionEligibleAt,
  calculateCommissionCents,
  getDefaultCommissionPercent,
  getDefaultCustomerDiscountPercent,
  DEFAULT_CUSTOMER_DISCOUNT_PERCENT,
}
