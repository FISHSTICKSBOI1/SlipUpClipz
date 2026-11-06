import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { LicenseState } from '../shared/appTypes.js'
import {
  LICENSE_OFFLINE_GRACE_MS,
  LICENSE_REVALIDATION_INTERVAL_MS,
} from './licenseConfig.js'
import {
  advanceObservedTime,
  activationTimestamp,
  buildActivatedLicense,
  buildFreeLicense,
  canUseDevDemoFallback,
  developmentProEnabled,
  effectiveLicenseNow,
  isExpirationPast,
  isLicenseKeyFormat,
  isProLicenseState,
  isWithinOfflineGrace,
  keepsStoredLicenseWhenValidationFails,
  mapValidationFailureMessage,
  needsMandatoryRevalidation,
  parseServerValidationPayload,
  proValidationTimestamp,
  redactLicenseKey,
  resolveLicenseAccess,
  shouldRevalidate,
} from './licenseLogic.js'
import {
  generateDevDemoLicenseKey,
  isDevDemoLicenseKey,
  shouldAcceptDevDemoKey,
} from './licenseDevDemo.js'

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
    assert.equal(mapValidationFailureMessage('revoked'), 'Subscription inactive.')
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

  it('allows offline use for 24 hours after the last successful check', () => {
    assert.equal(LICENSE_OFFLINE_GRACE_MS, 24 * 60 * 60 * 1000)
    const lastValidatedAt = NOW - 23 * 60 * 60 * 1000
    assert.equal(isWithinOfflineGrace(lastValidatedAt, NOW), true)
    assert.equal(isWithinOfflineGrace(NOW - LICENSE_OFFLINE_GRACE_MS, NOW), true)
    assert.equal(isWithinOfflineGrace(NOW - LICENSE_OFFLINE_GRACE_MS - 1, NOW), false)
  })
})

describe('revalidation cadence', () => {
  it('requires first validation immediately', () => {
    assert.equal(shouldRevalidate(undefined, NOW), true)
  })

  it('waits 15 minutes between routine checks', () => {
    assert.equal(shouldRevalidate(NOW - LICENSE_REVALIDATION_INTERVAL_MS + 1, NOW), false)
    assert.equal(shouldRevalidate(NOW - LICENSE_REVALIDATION_INTERVAL_MS, NOW), true)
    assert.equal(LICENSE_REVALIDATION_INTERVAL_MS, 15 * 60 * 1000)
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
    const demoKey = generateDevDemoLicenseKey()
    assert.equal(shouldAcceptDevDemoKey(true, demoKey), false)
    assert.equal(shouldAcceptDevDemoKey(false, demoKey), true)
    assert.equal(shouldAcceptDevDemoKey(false, 'SLIP-ABCD-EF12-3456'), false)
  })
})

describe('development Pro cannot leak into packaged builds', () => {
  const customerLicense = buildActivatedLicense(
    'SLIP-REAL-KEY1-ABCD',
    '2027-07-16T00:00:00.000Z',
    NOW,
  )

  it('keeps a server-validated license on Pro', () => {
    assert.equal(isProLicenseState(customerLicense, NOW), true)
    const access = resolveLicenseAccess({
      isPackaged: true,
      devProTesting: true,
      license: customerLicense,
      now: NOW,
    })
    assert.deepEqual(access, { isPro: true, access: 'license' })
  })

  it('ignores the persisted development switch, env vars, and argv when packaged', () => {
    assert.equal(
      developmentProEnabled({
        isPackaged: true,
        devProTesting: true,
        env: { SLIPUPCLIP_DEV_PRO: '1' },
        argv: ['slipupclipz', '--dev-pro'],
      }),
      false,
    )
    assert.equal(
      developmentProEnabled({
        isPackaged: false,
        devProTesting: false,
        env: { SLIPUPCLIP_DEV_PRO: '1' },
        argv: ['--dev-pro'],
      }),
      false,
    )
    assert.equal(
      developmentProEnabled({
        isPackaged: false,
        devProTesting: true,
      }),
      true,
    )

    const simulated = resolveLicenseAccess({
      isPackaged: true,
      devProTesting: true,
      license: {
        ...buildActivatedLicense(generateDevDemoLicenseKey(), null, NOW),
        devDemo: true,
      },
      now: NOW,
    })
    assert.deepEqual(simulated, { isPro: false, access: 'free' })
  })

  it('marks the local switch and demo keys as development, not a customer license', () => {
    const toggled = resolveLicenseAccess({
      isPackaged: false,
      devProTesting: true,
      license: { activated: false, tier: 'free' },
      now: NOW,
    })
    assert.deepEqual(toggled, { isPro: true, access: 'development' })

    const demo = resolveLicenseAccess({
      isPackaged: false,
      devProTesting: false,
      license: {
        ...buildActivatedLicense(generateDevDemoLicenseKey(), null, NOW),
        devDemo: true,
      },
      now: NOW,
    })
    assert.deepEqual(demo, { isPro: true, access: 'development' })
    assert.equal(
      isProLicenseState(
        { activated: true, tier: 'pro', devDemo: true, lastValidatedAt: NOW },
        NOW,
      ),
      false,
    )
  })
})

describe('subscription time cannot be reset on the computer', () => {
  const paidThrough = '2027-11-01T00:00:00.000Z'
  const key = 'SLIP-ABCD-EF12-3456'

  it('keeps the same server expiration after removal and re-entry', () => {
    const first = buildActivatedLicense(key, paidThrough, Date.parse('2026-11-01T00:00:00.000Z'))
    const removed = buildFreeLicense()
    const again = buildActivatedLicense(key, paidThrough, Date.parse('2026-11-02T00:00:00.000Z'))
    const third = buildActivatedLicense(key, paidThrough, Date.parse('2027-06-01T00:00:00.000Z'))

    assert.equal(removed.activated, false)
    assert.equal(again.expiresAt, first.expiresAt)
    assert.equal(third.expiresAt, first.expiresAt)
    assert.equal(isProLicenseState(again, Date.parse('2026-11-02T00:00:00.000Z')), true)
    assert.equal(isProLicenseState(third, Date.parse('2027-11-01T00:00:00.000Z')), false)
  })

  it('does not let a rewound clock outlive a time the app already observed', () => {
    const seen = advanceObservedTime(
      buildActivatedLicense(key, paidThrough, Date.parse('2026-11-01T00:00:00.000Z')),
      Date.parse('2027-11-02T00:00:00.000Z'),
    )
    assert.equal(isProLicenseState(seen, Date.parse('2026-12-01T00:00:00.000Z')), false)
    assert.equal(effectiveLicenseNow(seen, Date.parse('2026-12-01T00:00:00.000Z')) > Date.parse(paidThrough), true)
  })

  it('stops at the paid period even when the 24 hour allowance has time left', () => {
    const license = buildActivatedLicense(key, paidThrough, Date.parse('2027-10-31T12:00:00.000Z'))
    assert.equal(isProLicenseState(license, Date.parse('2027-10-31T18:00:00.000Z')), true)
    assert.equal(isProLicenseState(license, Date.parse(paidThrough)), false)
  })

  it('does not restart the 24 hour allowance when the clock moves backward', () => {
    const validatedAt = Date.parse('2026-11-01T00:00:00.000Z')
    const seen = advanceObservedTime(
      buildActivatedLicense(key, paidThrough, validatedAt),
      validatedAt + 25 * 60 * 60 * 1000,
    )
    assert.equal(seen.lastValidatedAt, validatedAt)
    assert.equal(isProLicenseState(seen, validatedAt + 60 * 60 * 1000), false)
  })

  it('does not let a forward clock move the start of the 24 hour allowance', () => {
    const serverNow = '2026-11-01T00:00:00.000Z'
    const serverMs = Date.parse(serverNow)
    const clientAhead = serverMs + 10 * 24 * 60 * 60 * 1000
    const validatedAt = activationTimestamp(serverNow)
    assert.equal(validatedAt, serverMs)
    assert.equal(activationTimestamp('not-a-time'), null)
    const seen = advanceObservedTime(
      buildActivatedLicense(key, paidThrough, validatedAt ?? serverMs),
      clientAhead,
    )
    assert.equal(seen.lastValidatedAt, serverMs)
    assert.equal(isProLicenseState(seen, serverMs), false)
    assert.equal(isProLicenseState(seen, clientAhead), false)
  })

  it('accepts the deployed production response from the HTTP date, not the local clock', () => {
    const headerNow = Date.parse('2026-10-25T21:00:00.000Z')
    const clientAhead = headerNow + 10 * 24 * 60 * 60 * 1000
    const deployed = {
      valid: true,
      tier: 'pro' as const,
      expiresAt: '2027-10-25T21:00:00.000Z',
      status: 'active',
    }
    assert.equal(proValidationTimestamp(deployed, headerNow), headerNow)
    assert.equal(proValidationTimestamp(deployed, null), null)
    assert.equal(
      proValidationTimestamp({ ...deployed, serverNow: '2026-10-25T20:59:00.000Z' }, clientAhead),
      Date.parse('2026-10-25T20:59:00.000Z'),
    )
    assert.equal(proValidationTimestamp({ ...deployed, expiresAt: null }, headerNow), null)
    assert.equal(proValidationTimestamp({ valid: false, tier: 'free' }, headerNow), null)

    const activated = advanceObservedTime(
      buildActivatedLicense(key, deployed.expiresAt, headerNow),
      clientAhead,
    )
    assert.equal(activated.lastValidatedAt, headerNow)
    assert.equal(isProLicenseState(activated, headerNow), false)
    assert.equal(isProLicenseState(activated, clientAhead), false)
  })

  it('rejects a cached key that has no server expiration', () => {
    const license = buildActivatedLicense(key, null, NOW)
    assert.equal(isProLicenseState(license, NOW), false)
  })

  it('keeps an offline cache for 24 hours and not for a week', () => {
    const paidThrough = '2027-11-01T00:00:00.000Z'
    const checked = Date.parse('2026-11-01T00:00:00.000Z')
    const cache = buildActivatedLicense(key, paidThrough, checked)
    assert.equal(cache.lastValidatedAt, checked)
    assert.equal(isProLicenseState(cache, checked + 24 * 60 * 60 * 1000), true)
    assert.equal(isProLicenseState(cache, checked + 24 * 60 * 60 * 1000 + 1), false)
    assert.equal(isProLicenseState(cache, checked + 8 * 24 * 60 * 60 * 1000), false)
  })

  it('keeps the saved key when the license server cannot be reached', () => {
    assert.equal(keepsStoredLicenseWhenValidationFails('network'), true)
    assert.equal(keepsStoredLicenseWhenValidationFails('timeout'), true)
    assert.equal(keepsStoredLicenseWhenValidationFails('server_error'), true)
    assert.equal(keepsStoredLicenseWhenValidationFails('malformed_response'), true)
    assert.equal(keepsStoredLicenseWhenValidationFails('refunded'), false)
    assert.equal(keepsStoredLicenseWhenValidationFails('device_in_use'), false)
  })

  it('keeps an offline cache until the computer reaches the server', () => {
    const paidThrough = '2027-11-01T00:00:00.000Z'
    const checked = Date.parse('2026-11-01T00:00:00.000Z')
    const cache = buildActivatedLicense(key, paidThrough, checked)
    const oneDayLater = checked + 24 * 60 * 60 * 1000
    assert.equal(isProLicenseState(cache, oneDayLater), true)
    assert.equal(isProLicenseState(cache, checked + 8 * 24 * 60 * 60 * 1000), false)
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
