const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  claimDeviceSeat,
  legacySeatAllowed,
  releaseDeviceSeat,
  replaceDeviceSeat,
  seatKey,
} = require('../../netlify/lib/device-seat.cjs')
const { wrapBlobStore } = require('../../netlify/lib/storage.cjs')
const {
  issueDeviceTransfer,
  markDeviceTransferUsed,
  readDeviceTransfer,
  transferMatches,
} = require('../../netlify/lib/device-transfer.cjs')

const KEY = 'SLIP-AAAA-BBBB-CCCC'
const COMPUTER_A = 'a'.repeat(64)
const COMPUTER_B = 'b'.repeat(64)
const EXPIRES = '2027-11-01T00:00:00.000Z'

function memoryStore() {
  const values = new Map()
  const etags = new Map()
  return {
    async getJSON(key) {
      return values.has(key) ? structuredClone(values.get(key)) : null
    },
    async getWithMetadata(key) {
      const data = await this.getJSON(key)
      if (!data) return null
      return { data, etag: etags.get(key) || 'existing' }
    },
    async setJSON(key, value, options = {}) {
      const current = values.get(key)
      const etag = current ? etags.get(key) || 'existing' : undefined
      if (options.onlyIfMatch && options.onlyIfMatch !== etag) return { modified: false }
      if (options.onlyIfNew && current) return { modified: false }
      const nextEtag = `${Math.random()}`
      values.set(key, structuredClone(value))
      etags.set(key, nextEtag)
      return { modified: true, etag: nextEtag }
    },
  }
}

describe('one computer per license', () => {
  it('lets the first computer activate and rejects the second', async () => {
    const store = memoryStore()
    const license = { licenseKey: KEY, expiresAt: EXPIRES }
    const first = await claimDeviceSeat(store, KEY, COMPUTER_A, '2026-11-01T00:00:00.000Z')
    const second = await claimDeviceSeat(store, KEY, COMPUTER_B, '2026-11-02T00:00:00.000Z')
    const seat = await store.getJSON(seatKey(KEY))

    assert.equal(first.ok, true)
    assert.equal(first.sameDevice, false)
    assert.equal(second.ok, false)
    assert.equal(second.reason, 'device_in_use')
    assert.equal(seat.deviceId, COMPUTER_A)
    assert.equal(seat.expiresAt, undefined)
    assert.equal(license.expiresAt, EXPIRES)
  })

  it('treats a reinstall of the same computer as the same registration', async () => {
    const store = memoryStore()
    await claimDeviceSeat(store, KEY, COMPUTER_A, '2026-11-01T00:00:00.000Z')
    const again = await claimDeviceSeat(store, KEY, COMPUTER_A, '2027-01-01T00:00:00.000Z')
    const seat = await store.getJSON(seatKey(KEY))
    assert.equal(again.sameDevice, true)
    assert.equal(seat.registeredAt, '2026-11-01T00:00:00.000Z')
    assert.equal(seat.expiresAt, undefined)
  })

  it('frees the computer after deactivation so the replacement can activate', async () => {
    const store = memoryStore()
    await claimDeviceSeat(store, KEY, COMPUTER_A)
    const released = await releaseDeviceSeat(store, KEY, COMPUTER_A)
    const moved = await claimDeviceSeat(store, KEY, COMPUTER_B)
    assert.equal(released.released, true)
    assert.equal(moved.ok, true)
    assert.equal((await store.getJSON(seatKey(KEY))).deviceId, COMPUTER_B)
  })

  it('does not let a different computer release the seat', async () => {
    const store = memoryStore()
    await claimDeviceSeat(store, KEY, COMPUTER_A)
    const released = await releaseDeviceSeat(store, KEY, COMPUTER_B)
    assert.equal(released.reason, 'not-held')
    assert.equal((await store.getJSON(seatKey(KEY))).deviceId, COMPUTER_A)
  })

  it('does not treat a missing device id as permission to share the license', () => {
    assert.equal(legacySeatAllowed(), false)
  })

  it('registers only one computer when two claims race', async () => {
    const store = memoryStore()
    let reads = 0
    let open
    const gate = new Promise((resolve) => {
      open = resolve
    })
    const read = store.getWithMetadata.bind(store)
    store.getWithMetadata = async (key) => {
      const snapshot = await read(key)
      reads += 1
      if (reads === 1) {
        await gate
        return snapshot
      }
      open()
      return snapshot
    }

    const [first, second] = await Promise.all([
      claimDeviceSeat(store, KEY, COMPUTER_A),
      claimDeviceSeat(store, KEY, COMPUTER_B),
    ])
    const winners = [first, second].filter((result) => result.ok)
    assert.equal(winners.length, 1)
    assert.equal([first, second].some((result) => result.reason === 'device_in_use'), true)
  })

  it('moves a lost computer to the computer that requested the code', async () => {
    const store = memoryStore()
    await claimDeviceSeat(store, KEY, COMPUTER_A)
    const issued = await issueDeviceTransfer({
      store,
      licenseKey: KEY,
      deviceId: COMPUTER_B,
      now: new Date('2026-11-02T00:00:00.000Z'),
    })
    const pending = await readDeviceTransfer(store, issued.code, new Date('2026-11-02T00:30:00.000Z'))
    assert.equal(transferMatches(pending.record, KEY, COMPUTER_B), true)
    assert.equal(transferMatches(pending.record, KEY, COMPUTER_A), false)

    const license = { expiresAt: EXPIRES }
    const replaced = await replaceDeviceSeat(store, KEY, COMPUTER_B, '2026-11-02T00:30:00.000Z')
    await markDeviceTransferUsed(store, issued.code, new Date('2026-11-02T00:30:00.000Z'))
    const reused = await readDeviceTransfer(store, issued.code, new Date('2026-11-02T00:40:00.000Z'))

    assert.equal(replaced.ok, true)
    assert.equal((await store.getJSON(seatKey(KEY))).deviceId, COMPUTER_B)
    assert.equal((await store.getJSON(seatKey(KEY))).expiresAt, undefined)
    assert.equal(license.expiresAt, EXPIRES)
    assert.equal(reused.reason, 'used')
  })
})

function headerValue(headers, name) {
  if (!headers) return undefined
  if (typeof headers.get === 'function') return headers.get(name)
  return headers[name]
}

/**
 * In-memory stand-in for the Netlify Blobs API. It honors If-None-Match: *
 * and If-Match the way the blob service does, and records the headers the
 * real @netlify/blobs client actually sends.
 */
function installBlobFetch() {
  const originalFetch = global.fetch
  let body = null
  let etag = '"none"'
  const writes = []

  global.fetch = async (_url, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase()
    if (method === 'GET') {
      if (!body) return new Response('', { status: 404 })
      return new Response(body, {
        status: 200,
        headers: { etag, 'content-type': 'application/json' },
      })
    }

    const ifNoneMatch = headerValue(options.headers, 'if-none-match') ?? null
    const ifMatch = headerValue(options.headers, 'if-match') ?? null
    writes.push({ ifNoneMatch, ifMatch })
    if (!ifNoneMatch && !ifMatch) {
      body = typeof options.body === 'string' ? options.body : body
      etag = '"unconditional"'
      return new Response('', { status: 200, headers: { etag } })
    }
    if (ifNoneMatch === '*' && body) return new Response('', { status: 412 })
    if (ifMatch && ifMatch !== etag) return new Response('', { status: 412 })
    body = typeof options.body === 'string' ? options.body : body
    etag = `"seat-${writes.length}"`
    return new Response('', { status: 200, headers: { etag } })
  }

  return {
    writes,
    snapshot: () => body,
    restore: () => {
      global.fetch = originalFetch
    },
  }
}

function testBlobStore() {
  const { getStore } = require('@netlify/blobs')
  return getStore('slipupclipz-commerce', {
    siteID: 'site_test',
    token: 'token_test',
    edgeURL: 'https://edge.example.test',
  })
}

describe('Netlify Blobs conditional writes', () => {
  it('shows setJSON on @netlify/blobs 10.7.9 does not send a conditional header', async () => {
    const blob = installBlobFetch()
    try {
      await testBlobStore().setJSON(seatKey(KEY), { deviceId: COMPUTER_A }, { onlyIfNew: true })
      assert.deepEqual(blob.writes, [{ ifNoneMatch: null, ifMatch: null }])
    } finally {
      blob.restore()
    }
  })

  it('uses the production store wrapper so only one concurrent claim can create the seat', async () => {
    const blob = installBlobFetch()
    try {
      const store = wrapBlobStore(testBlobStore(), 'production')
      const [first, second] = await Promise.all([
        claimDeviceSeat(store, KEY, COMPUTER_A),
        claimDeviceSeat(store, KEY, COMPUTER_B),
      ])
      assert.equal(blob.writes.length > 0, true)
      assert.equal(
        blob.writes.every((write) => write.ifNoneMatch === '*' || write.ifMatch),
        true,
      )
      const winners = [first, second].filter((result) => result.ok)
      assert.equal(winners.length, 1)
      assert.equal([first, second].some((result) => result.reason === 'device_in_use'), true)
      assert.equal(JSON.parse(blob.snapshot()).deviceId, winners[0].deviceId)
    } finally {
      blob.restore()
    }
  })

  it('sends If-Match when replacing a seat through the production wrapper', async () => {
    const blob = installBlobFetch()
    try {
      const store = wrapBlobStore(testBlobStore(), 'production')
      const claimed = await claimDeviceSeat(store, KEY, COMPUTER_A)
      assert.equal(claimed.ok, true)
      const moved = await replaceDeviceSeat(store, KEY, COMPUTER_B)
      assert.equal(moved.ok, true)
      assert.equal(JSON.parse(blob.snapshot()).deviceId, COMPUTER_B)
      assert.equal(blob.writes.some((write) => write.ifNoneMatch === '*'), true)
      assert.equal(blob.writes.some((write) => write.ifMatch), true)
      assert.equal(blob.writes.every((write) => write.ifNoneMatch === '*' || write.ifMatch), true)
    } finally {
      blob.restore()
    }
  })
})
