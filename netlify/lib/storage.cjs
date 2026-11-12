const { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

const STORE_NAME = process.env.COMMERCE_STORE_NAME || 'slipupclipz-commerce'
function devStoreDir() {
  return process.env.COMMERCE_DEV_DIR || join(__dirname, '../../.netlify/commerce-dev')
}

function ensureDevDir() {
  const dir = devStoreDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function devStorePath(key) {
  const safeKey = key.replace(/[^a-zA-Z0-9:_-]/g, '_')
  return join(devStoreDir(), `${safeKey}.json`)
}

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

function getNetlifyBlobStore(fetch) {
  const blobs = loadBlobsModule()
  if (!blobs || typeof blobs.getStore !== 'function') {
    throw new Error('@netlify/blobs is not available')
  }

  return blobs.getStore(STORE_NAME, { fetch })
}

async function writeConditionalBlob(createStore, key, value, options) {
  let status
  // This client is scoped to one write. Never let the SDK retry an ambiguous PUT
  // or mistake its result for a confirmed write or genuine precondition failure.
  const store = createStore(async (url, request) => {
    const headers = new Headers(request?.headers)
    if (!headers.has('if-match') && !headers.has('if-none-match')) {
      return globalThis.fetch(url, request)
    }
    try {
      const response = await globalThis.fetch(url, { ...request, redirect: 'error' })
      status = response.status
      if (status === 200 || status === 412) return response
    } catch {
      status = undefined
    }
    // Stop the SDK retry loop. The actual outcome is checked below.
    return new Response(null, { status: 412 })
  })
  const result = await store.set(key, value, options)
  if (status === 200 && result?.modified === true) return result
  if (status === 412 && result?.modified === false) return result
  throw new Error('Netlify Blobs conditional write could not be confirmed')
}

function wrapBlobStore(createStore, environment) {
  const store = createStore()
  return {
    environment,
    async get(key, options) {
      return store.get(key, options)
    },
    async set(key, value, options) {
      if (options?.onlyIfNew || options?.onlyIfMatch) {
        return writeConditionalBlob(createStore, key, value, options)
      }
      return store.set(key, value, options)
    },
    async setJSON(key, value, options) {
      const conditional = Boolean(options?.onlyIfNew || options?.onlyIfMatch)
      // @netlify/blobs 10.7.9 Store.setJSON spreads onlyIfNew/onlyIfMatch onto
      // makeRequest, but makeRequest only reads a nested `conditions` object.
      // The If-None-Match and If-Match headers are never sent, so two concurrent
      // setJSON calls can both succeed. Store.set passes `conditions` correctly.
      if (conditional) {
        return writeConditionalBlob(createStore, key, JSON.stringify(value), options)
      }
      return store.setJSON(key, value, options)
    },
    async getJSON(key) {
      return store.get(key, { type: 'json' })
    },
    async getWithMetadata(key, options = {}) {
      if (typeof store.getWithMetadata !== 'function') {
        const data = await store.get(key, { type: 'json' })
        return data ? { data, etag: undefined } : null
      }
      return store.getWithMetadata(key, { ...options, type: 'json' })
    },
    async delete(key) {
      await store.delete(key)
    },
    async list(options) {
      return store.list(options)
    },
  }
}

const devWriteTails = new Map()
const devEtags = new Map()

function enqueueDevWrite(key, task) {
  const previous = devWriteTails.get(key) || Promise.resolve()
  const run = previous.then(task, task)
  devWriteTails.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  )
  return run
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
      return enqueueDevWrite(key, async () => {
        const existing = await this.getJSON(key)
        const currentEtag = existing ? devEtags.get(key) || 'dev-existing' : undefined
        if (options.onlyIfMatch && options.onlyIfMatch !== currentEtag) {
          return { modified: false }
        }
        if (options.onlyIfNew && existing != null) {
          return { modified: false }
        }

        const etag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
        devEtags.set(key, etag)
        await this.set(
          key,
          JSON.stringify({
            ...value,
            _storeEnvironment: 'dev-local',
          }),
        )
        return { modified: true, etag }
      })
    },
    async getJSON(key) {
      return this.get(key, { type: 'json' })
    },
    async getWithMetadata(key) {
      const data = await this.getJSON(key)
      if (!data) return null
      return { data, etag: devEtags.get(key) || 'dev-existing' }
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
      const files = readdirSync(devStoreDir()).filter((file) => file.endsWith('.json'))

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
      return wrapBlobStore(getNetlifyBlobStore, 'production')
    } catch (error) {
      throw new Error(
        `Netlify Blobs is required in production commerce storage: ${error instanceof Error ? error.message : error}`,
      )
    }
  }

  if (isLocalNetlifyDev()) {
    try {
      return wrapBlobStore(getNetlifyBlobStore, 'production')
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

async function getLicenseByEmail(email) {
  const store = await getCommerceStore()
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return null
  const pointer = await store.getJSON(`email:${normalized}`)
  if (!pointer?.licenseKey) return null
  return store.getJSON(`license:${pointer.licenseKey}`)
}

async function listLicenseRecords() {
  const store = await getCommerceStore()
  const listed = await store.list({ prefix: 'license:' })
  const blobs = Array.isArray(listed?.blobs) ? listed.blobs : []
  const records = []
  for (const blob of blobs) {
    if (!blob?.key) continue
    const record = await store.getJSON(blob.key)
    if (record?.licenseKey) records.push(record)
  }
  return records
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
  writeConditionalBlob,
  connectCommerceBlobs,
  getCommerceStore,
  licenseExists,
  getLicenseByKey,
  saveLicenseRecord,
  getLicenseBySubscriptionId,
  getLicenseByChargeId,
  getLicenseByEmail,
  listLicenseRecords,
  getLicenseByPaymentIntentId,
  recordAffiliateCommission,
  adjustAffiliateCommission,
  isNetlifyProduction,
  isDeployedNetlifyRuntime,
  wrapBlobStore,
}