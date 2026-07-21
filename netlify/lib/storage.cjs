const { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

const STORE_NAME = process.env.COMMERCE_STORE_NAME || 'slipupclipz-commerce'
const DEV_STORE_DIR = join(__dirname, '../../.netlify/commerce-dev')

function isDeployedNetlifyRuntime() {
  // Deployed Netlify Functions expose SITE_ID. Do not use build-only vars
  // (CONTEXT, NETLIFY, DEPLOY_PRIME_URL) or NODE_ENV for this check.
  return Boolean(process.env.SITE_ID)
}

function isNetlifyProduction() {
  return isDeployedNetlifyRuntime()
}

function isLocalNetlifyDev() {
  return process.env.NETLIFY_DEV === 'true'
}

function loadBlobsModule() {
  try {
    return require('@netlify/blobs')
  } catch {
    return null
  }
}

function logStorageDiagnostics(blobsModuleLoaded) {
  console.info('[commerce-storage] runtime', {
    hasSiteId: Boolean(process.env.SITE_ID),
    hasUrl: Boolean(process.env.URL),
    isLocalDev: isLocalNetlifyDev(),
    blobsModuleLoaded: Boolean(blobsModuleLoaded),
  })
}

/**
 * Lambda-compat handlers must call this once per request before getStore().
 * @netlify/blobs@8.x requires connectLambda(event) in Lambda compatibility mode.
 */
function connectCommerceBlobs(event) {
  if (!event || typeof event !== 'object') return

  const blobs = loadBlobsModule()
  if (!blobs || typeof blobs.connectLambda !== 'function') return
  if (typeof event.blobs !== 'string' || !event.blobs) return

  blobs.connectLambda(event)
}

function getNetlifyBlobStore() {
  const blobs = loadBlobsModule()
  if (!blobs || typeof blobs.getStore !== 'function') {
    throw new Error('@netlify/blobs is not available')
  }

  return blobs.getStore(STORE_NAME)
}

function wrapBlobStore(store, environment) {
  return {
    environment,
    async get(key, options) {
      return store.get(key, options)
    },
    async set(key, value, options) {
      return store.set(key, value, options)
    },
    async setJSON(key, value, options) {
      return store.setJSON(key, value, options)
    },
    async getJSON(key) {
      return store.get(key, { type: 'json' })
    },
    async delete(key) {
      await store.delete(key)
    },
    async list(options) {
      return store.list(options)
    },
  }
}

function ensureDevDir() {
  if (!existsSync(DEV_STORE_DIR)) {
    mkdirSync(DEV_STORE_DIR, { recursive: true })
  }
}

function devStorePath(key) {
  const safeKey = key.replace(/[^a-zA-Z0-9:_-]/g, '_')
  return join(DEV_STORE_DIR, `${safeKey}.json`)
}

function createDevStore() {
  ensureDevDir()

  return {
    environment: 'dev-local',
    async get(key, options) {
      const type = options?.type || 'text'
      const filePath = devStorePath(key)
      if (!existsSync(filePath)) return null

      const raw = readFileSync(filePath, 'utf8')
      if (!raw) return null

      if (type === 'json') {
        try {
          const parsed = JSON.parse(raw)
          if (parsed?._storeEnvironment && parsed._storeEnvironment !== 'dev-local') {
            return null
          }
          return parsed
        } catch {
          return null
        }
      }

      return raw
    },
    async set(key, value) {
      writeFileSync(devStorePath(key), value, 'utf8')
      return { modified: true }
    },
    async setJSON(key, value, options = {}) {
      if (options.onlyIfNew) {
        const existing = await this.getJSON(key)
        if (existing != null) {
          return { modified: false }
        }
      }

      await this.set(
        key,
        JSON.stringify({
          ...value,
          _storeEnvironment: 'dev-local',
        }),
      )
      return { modified: true }
    },
    async getJSON(key) {
      return this.get(key, { type: 'json' })
    },
    async delete(key) {
      const filePath = devStorePath(key)
      if (existsSync(filePath)) {
        writeFileSync(filePath, '', 'utf8')
      }
    },
    async list(options) {
      ensureDevDir()
      const prefix = options?.prefix || ''
      const files = readdirSync(DEV_STORE_DIR).filter((file) => file.endsWith('.json'))

      return {
        blobs: files
          .map((file) => file.replace(/\.json$/, ''))
          .filter((key) => key.startsWith(prefix.replace(/[^a-zA-Z0-9:_-]/g, '_')))
          .map((key) => ({ key })),
      }
    },
  }
}

async function getCommerceStore() {
  const blobsModule = loadBlobsModule()
  logStorageDiagnostics(Boolean(blobsModule))

  if (isDeployedNetlifyRuntime()) {
    try {
      return wrapBlobStore(getNetlifyBlobStore(), 'production')
    } catch (error) {
      throw new Error(
        `Netlify Blobs is required in production commerce storage: ${error instanceof Error ? error.message : error}`,
      )
    }
  }

  if (isLocalNetlifyDev()) {
    try {
      return wrapBlobStore(getNetlifyBlobStore(), 'production')
    } catch {
      console.warn('[commerce-storage] Using dev-local file store. Never use this data in production.')
      return createDevStore()
    }
  }

  // Never silently fall back to local files outside genuine local Netlify dev.
  throw new Error('Commerce storage is unavailable outside Netlify production or local Netlify dev.')
}

async function licenseExists(licenseKey) {
  const store = await getCommerceStore()
  const record = await store.getJSON(`license:${licenseKey}`)
  return Boolean(record)
}

async function getLicenseByKey(licenseKey) {
  const store = await getCommerceStore()
  return store.getJSON(`license:${licenseKey}`)
}

async function saveLicenseRecord(record) {
  const store = await getCommerceStore()
  const payload = {
    ...record,
    _storeEnvironment: store.environment,
    updatedAt: new Date().toISOString(),
  }

  await store.setJSON(`license:${record.licenseKey}`, payload)

  if (record.email) {
    await store.setJSON(`email:${record.email.toLowerCase()}`, {
      licenseKey: record.licenseKey,
      updatedAt: payload.updatedAt,
      _storeEnvironment: store.environment,
    })
  }

  if (record.stripeCustomerId) {
    await store.setJSON(`customer:${record.stripeCustomerId}`, {
      licenseKey: record.licenseKey,
      email: record.email,
      updatedAt: payload.updatedAt,
      _storeEnvironment: store.environment,
    })
  }

  if (record.stripeSubscriptionId) {
    await store.setJSON(`subscription:${record.stripeSubscriptionId}`, {
      licenseKey: record.licenseKey,
      updatedAt: payload.updatedAt,
      _storeEnvironment: store.environment,
    })
  }

  if (record.stripeLatestChargeId) {
    await store.setJSON(`charge:${record.stripeLatestChargeId}`, {
      licenseKey: record.licenseKey,
      updatedAt: payload.updatedAt,
      _storeEnvironment: store.environment,
    })
  }

  if (record.stripePaymentIntentId) {
    await store.setJSON(`payment-intent:${record.stripePaymentIntentId}`, {
      licenseKey: record.licenseKey,
      updatedAt: payload.updatedAt,
      _storeEnvironment: store.environment,
    })
  }
}

async function getLicenseBySubscriptionId(subscriptionId) {
  const store = await getCommerceStore()
  const pointer = await store.getJSON(`subscription:${subscriptionId}`)
  if (!pointer?.licenseKey) return null

  return store.getJSON(`license:${pointer.licenseKey}`)
}

async function getLicenseByChargeId(chargeId) {
  const store = await getCommerceStore()
  const pointer = await store.getJSON(`charge:${chargeId}`)
  if (!pointer?.licenseKey) return null

  return store.getJSON(`license:${pointer.licenseKey}`)
}

async function getLicenseByPaymentIntentId(paymentIntentId) {
  const store = await getCommerceStore()
  const pointer = await store.getJSON(`payment-intent:${paymentIntentId}`)
  if (!pointer?.licenseKey) return null

  return store.getJSON(`license:${pointer.licenseKey}`)
}

async function recordAffiliateCommission(code, commissionRecord) {
  const store = await getCommerceStore()
  const statsKey = `affiliate-stats:${code.toUpperCase()}`
  const current = (await store.getJSON(statsKey)) || {
    code: code.toUpperCase(),
    totalSalesCents: 0,
    successfulPurchases: 0,
    pendingCommissionCents: 0,
    approvedCommissionCents: 0,
    revokedCommissionCents: 0,
    stripeCustomerIds: [],
    lastPurchaseAt: null,
    _storeEnvironment: store.environment,
  }

  const stripeCustomerIds = new Set(current.stripeCustomerIds || [])
  if (commissionRecord.stripeCustomerId) {
    stripeCustomerIds.add(commissionRecord.stripeCustomerId)
  }

  const next = {
    ...current,
    totalSalesCents: current.totalSalesCents + (commissionRecord.commissionableCents || 0),
    successfulPurchases: current.successfulPurchases + 1,
    pendingCommissionCents:
      current.pendingCommissionCents + (commissionRecord.commissionAmountCents || 0),
    stripeCustomerIds: [...stripeCustomerIds],
    lastPurchaseAt: new Date().toISOString(),
    _storeEnvironment: store.environment,
  }

  await store.setJSON(statsKey, next)
  await store.setJSON(`affiliate-commission:${commissionRecord.id}`, {
    ...commissionRecord,
    _storeEnvironment: store.environment,
  })

  return next
}

async function adjustAffiliateCommission(code, adjustment) {
  const store = await getCommerceStore()
  const statsKey = `affiliate-stats:${code.toUpperCase()}`
  const current = await store.getJSON(statsKey)
  if (!current) return null

  const next = {
    ...current,
    pendingCommissionCents: Math.max(
      0,
      (current.pendingCommissionCents || 0) - (adjustment.fromPending || 0),
    ),
    approvedCommissionCents: Math.max(
      0,
      (current.approvedCommissionCents || 0) -
        (adjustment.fromApproved || 0) +
        (adjustment.addApproved || 0),
    ),
    revokedCommissionCents:
      (current.revokedCommissionCents || 0) + (adjustment.addRevoked || 0),
    updatedAt: new Date().toISOString(),
  }

  await store.setJSON(statsKey, next)
  return next
}

module.exports = {
  connectCommerceBlobs,
  getCommerceStore,
  licenseExists,
  getLicenseByKey,
  saveLicenseRecord,
  getLicenseBySubscriptionId,
  getLicenseByChargeId,
  getLicenseByPaymentIntentId,
  recordAffiliateCommission,
  adjustAffiliateCommission,
  isNetlifyProduction,
  isDeployedNetlifyRuntime,
}
