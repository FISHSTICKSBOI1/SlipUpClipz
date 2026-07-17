const { adjustAffiliateCommission } = require('./storage.cjs')

async function maybeApprovePendingAffiliateCommission(license) {
  const commission = license.affiliateCommission
  if (!commission || commission.status !== 'pending' || !license.affiliateCode) {
    return license
  }

  if (['refunded', 'revoked', 'disputed'].includes(license.status)) {
    return license
  }

  if (Date.parse(commission.eligibleAt) > Date.now()) {
    return license
  }

  await adjustAffiliateCommission(license.affiliateCode, {
    fromPending: commission.commissionAmountCents,
    addApproved: commission.commissionAmountCents,
  })

  return {
    ...license,
    affiliateCommission: {
      ...commission,
      status: 'approved',
      approvedAt: new Date().toISOString(),
    },
  }
}

async function revokeAffiliateCommissionAmount(code, commission, revokeCents) {
  if (!code || !commission || revokeCents <= 0) {
    return
  }

  if (commission.status === 'approved') {
    await adjustAffiliateCommission(code, {
      fromApproved: revokeCents,
      addRevoked: revokeCents,
    })
    return
  }

  await adjustAffiliateCommission(code, {
    fromPending: revokeCents,
    addRevoked: revokeCents,
  })
}

module.exports = {
  maybeApprovePendingAffiliateCommission,
  revokeAffiliateCommissionAmount,
}
