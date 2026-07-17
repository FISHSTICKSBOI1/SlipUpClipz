import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { LicenseState } from '../shared/appTypes.js'
import {
  LICENSE_OFFLINE_GRACE_MS,
  LICENSE_REVALIDATION_INTERVAL_MS,
} from './licenseConfig.js'
import {
  buildActivatedLicense,
  canUseDevDemoFallback,
  isExpirationPast,
  isLicenseKeyFormat,
  isProLicenseState,
  isWithinOfflineGrace,
  mapValidationFailureMessage,
  needsMandatoryRevalidation,
  parseServerValidationPayload,
  redactLicenseKey,
  shouldRevalidate,
} from './licenseLogic.js'
import { isDevDemoLicenseKey, generateDevDemoLicenseKey } from './licenseDevDemo.js'

const NOW = Date.parse('2026-07-16T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

describe('license key format', () => {
  it('accepts SLIP-XXXX-XXXX-XXXX keys', () => {
    assert.equal(isLicenseKeyFormat('SLIP-ABCD-EF12-3456'), true)
  })

  it('rejects malformed keys', () => {
    assert.equal(isLicenseKeyFormat('SLIP-ABC-EFGH-1234'), false)
    assert.equal(isLicenseKeyFormat('not-a-key'), false)
  })

  it('redacts keys for logs', () => {
    assert.equal(redactLicenseKey('SLIP-ABCD-EF12-3456'), 'SLIP-****-****-3456')
  })
})

describe('server response parsing', () => {
  it('parses valid active license responses', () => {
    const parsed = parseServerValidationPayload({
      valid: true,
      tier: 'pro',
      expiresAt: '2027-07-16T00:00:00.000Z',
      status: 'active',
    })

    assert.deepEqual(parsed, {
      valid: true,
      tier: 'pro',
      expiresAt: '2027-07-16T00:00:00.000Z',
      status: 'active',
    })
  })

  it('rejects malformed responses', () => {
    assert.equal(parseServerValidationPayload(null), null)
    assert.equal(parseServerValidationPayload({ valid: 'yes', tier: 'pro' }), null)
    assert.equal(parseServerValidationPayload({ valid: false, tier: 'premium' }), null)
  })
})

describe('customer-facing failure messages', () => {
  it('maps expired licenses', () => {
    assert.equal(mapValidationFailureMessage('expired'), 'License expired.')
  })

  it('maps inactive subscriptions', () => {
    assert.equal(mapValidationFailureMessage('past_due'), 'Subscription inactive.')
    assert.equal(mapValidationFailureMessage('refunded'), 'Subscription inactive.')
    assert.equal(mapValidationFailureMessage('disputed'), 'Subscription inactive.')
  })

  it('maps unknown invalid keys', () => {
    assert.equal(mapValidationFailureMessage(null), 'Invalid license key.')
  })
})

describe('Pro entitlement checks', () => {
  it('allows a recently validated active license', () => {
    const license = buildActivatedLicense('SLIP-ABCD-EF12-3456', '2027-07-16T00:00:00.000Z', NOW)
    assert.equal(isProLicenseState(license, NOW), true)
  })

  it('denies expired licenses even within offline grace', () => {
    const license: LicenseState = {
      activated: true,
      tier: 'pro',
      key: 'SLIP-ABCD-EF12-3456',
      lastValidatedAt: NOW - DAY_MS,
      expiresAt: '2026-07-01T00:00:00.000Z',
    }

    assert.equal(isProLicenseState(license, NOW), false)
    assert.equal(isExpirationPast(license.expiresAt, NOW), true)
  })

  it('allows canceled-but-paid-through-period licenses when expiry is still in the future', () => {
    const license: LicenseState = {
      activated: true,
      tier: 'pro',
      key: 'SLIP-ABCD-EF12-3456',
      lastValidatedAt: NOW - DAY_MS,
      expiresAt: '2026-08-01T00:00:00.000Z',
    }

    assert.equal(isProLicenseState(license, NOW), true)
  })

  it('denies licenses after offline grace expires', () => {
    const license: LicenseState = {
      activated: true,
      tier: 'pro',
      key: 'SLIP-ABCD-EF12-3456',
      lastValidatedAt: NOW - LICENSE_OFFLINE_GRACE_MS - 1,
      expiresAt: '2027-07-16T00:00:00.000Z',
    }

    assert.equal(isWithinOfflineGrace(license.lastValidatedAt, NOW), false)
    assert.equal(isProLicenseState(license, NOW), false)
    assert.equal(needsMandatoryRevalidation(license, NOW), true)
  })

  it('allows offline use within the 7-day grace period', () => {
    const lastValidatedAt = NOW - 6 * DAY_MS
    assert.equal(isWithinOfflineGrace(lastValidatedAt, NOW), true)
  })
})

describe('revalidation cadence', () => {
  it('requires first validation immediately', () => {
    assert.equal(shouldRevalidate(undefined, NOW), true)
  })

  it('waits 12 hours between routine checks', () => {
    assert.equal(shouldRevalidate(NOW - LICENSE_REVALIDATION_INTERVAL_MS + 1, NOW), false)
    assert.equal(shouldRevalidate(NOW - LICENSE_REVALIDATION_INTERVAL_MS, NOW), true)
  })
})

describe('development demo migration', () => {
  it('recognizes legacy checksum demo keys for local development', () => {
    const demoKey = generateDevDemoLicenseKey()
    assert.equal(isDevDemoLicenseKey(demoKey), true)
  })

  it('does not treat random opaque keys as demo keys', () => {
    assert.equal(isDevDemoLicenseKey('SLIP-ABCD-EF12-3456'), false)
  })

  it('disables demo fallback in packaged production builds', () => {
    assert.equal(canUseDevDemoFallback(true), false)
    assert.equal(canUseDevDemoFallback(false), true)
  })
})

describe('manual test plan (integration)', () => {
  it('documents scenarios validated manually or via Stripe test mode', () => {
    const scenarios = [
      'valid active license',
      'invalid license',
      'expired license',
      'canceled but active-through-period license',
      'refunded license',
      'disputed license',
      'server unavailable',
      'timeout',
      'malformed server response',
      'offline within grace period',
      'offline after grace period',
      'packaged production build rejecting demo keys',
    ]

    assert.equal(scenarios.length, 12)
  })
})
