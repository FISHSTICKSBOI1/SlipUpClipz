const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { legacyDeviceValidationAllowed } = require('../../netlify/lib/legacy-client.cjs')

const COMPUTER_A = 'a'.repeat(64)
const COMPUTER_B = 'b'.repeat(64)
const EXPIRES = '2027-11-01T00:00:00.000Z'
const storeDir = mkdtempSync(join(tmpdir(), 'slipup-legacy-seat-'))

after(() => {
  rmSync(storeDir, { recursive: true, force: true })
})

function rememberEnv() {
  return {
    COMMERCE_DEV_DIR: process.env.COMMERCE_DEV_DIR,
    NETLIFY_DEV: process.env.NETLIFY_DEV,
    SITE_ID: process.env.SITE_ID,
    LEGACY_DEVICE_GRACE_UNTIL: process.env.LEGACY_DEVICE_GRACE_UNTIL,
  }
}

function restoreEnv(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

async function saveActiveLicense(licenseKey) {
  const { saveLicenseRecord, getCommerceStore } = require('../../netlify/lib/storage.cjs')
  const store = await getCommerceStore()
  assert.equal(store.environment, 'dev-local')
  await saveLicenseRecord({
    licenseKey,
    email: 'legacy-seat-test@example.com',
    status: 'active',
    tier: 'pro',
    expiresAt: EXPIRES,
  })
  return store
}

describe('legacy grace control', () => {
  it('stays open until a cutoff is configured, and a bad value does not lock customers out', () => {
    assert.equal(legacyDeviceValidationAllowed(new Date('2028-06-01T00:00:00.000Z'), {}), true)
    assert.equal(
      legacyDeviceValidationAllowed(new Date('2028-06-01T00:00:00.000Z'), {
        LEGACY_DEVICE_GRACE_UNTIL: 'not-a-date',
      }),
      true,
    )
    assert.equal(
      legacyDeviceValidationAllowed(new Date('2027-01-01T00:00:00.000Z'), {
        LEGACY_DEVICE_GRACE_UNTIL: '2027-06-01T00:00:00.000Z',
      }),
      true,
    )
    assert.equal(
      legacyDeviceValidationAllowed(new Date('2027-07-01T00:00:00.000Z'), {
        LEGACY_DEVICE_GRACE_UNTIL: '2027-06-01T00:00:00.000Z',
      }),
      false,
    )
  })
})

describe('legacy clients during the upgrade grace period', { concurrency: 1 }, () => {
  it('keeps a v0.1.5 validation valid without taking the computer seat', async () => {
    const previous = rememberEnv()
    process.env.COMMERCE_DEV_DIR = storeDir
    process.env.NETLIFY_DEV = 'true'
    process.env.LEGACY_DEVICE_GRACE_UNTIL = '2099-01-01T00:00:00.000Z'
    delete process.env.SITE_ID
    const licenseKey = 'SLIP-LEG1-SEAT-0001'

    try {
      const store = await saveActiveLicense(licenseKey)
      const { handler } = require('../../netlify/functions/validate-license.cjs')
      const legacy = await handler({
        httpMethod: 'POST',
        body: JSON.stringify({ licenseKey }),
      })
      const legacyBody = JSON.parse(legacy.body)
      assert.equal(legacy.statusCode, 200)
      assert.equal(legacyBody.valid, true)
      assert.equal(legacyBody.legacyClient, true)
      assert.equal(legacyBody.expiresAt, EXPIRES)
      assert.equal(await store.getJSON(`seat:${licenseKey}`), null)

      const current = await handler({
        httpMethod: 'POST',
        body: JSON.stringify({ licenseKey, deviceId: COMPUTER_A }),
      })
      const activated = JSON.parse(current.body)
      assert.equal(activated.valid, true)
      assert.equal(activated.expiresAt, EXPIRES)

      const other = await handler({
        httpMethod: 'POST',
        body: JSON.stringify({ licenseKey, deviceId: COMPUTER_B }),
      })
      const rejected = JSON.parse(other.body)
      assert.equal(rejected.valid, false)
      assert.equal(rejected.status, 'device_in_use')

      const stillThere = await store.getJSON(`license:${licenseKey}`)
      assert.equal(stillThere.expiresAt, EXPIRES)
    } finally {
      restoreEnv(previous)
    }
  })

  it('rejects a missing device id after the grace date', async () => {
    const previous = rememberEnv()
    process.env.COMMERCE_DEV_DIR = storeDir
    process.env.NETLIFY_DEV = 'true'
    process.env.LEGACY_DEVICE_GRACE_UNTIL = '2000-01-01T00:00:00.000Z'
    delete process.env.SITE_ID
    const licenseKey = 'SLIP-LEG2-SEAT-0002'

    try {
      const store = await saveActiveLicense(licenseKey)
      const { handler } = require('../../netlify/functions/validate-license.cjs')
      const legacy = await handler({
        httpMethod: 'POST',
        body: JSON.stringify({ licenseKey }),
      })
      const body = JSON.parse(legacy.body)
      assert.equal(legacy.statusCode, 200)
      assert.equal(body.valid, false)
      assert.equal(body.status, 'device_required')
      assert.equal(await store.getJSON(`seat:${licenseKey}`), null)
      assert.equal((await store.getJSON(`license:${licenseKey}`)).expiresAt, EXPIRES)
    } finally {
      restoreEnv(previous)
    }
  })
})
