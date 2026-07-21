const test = require('node:test')
const assert = require('node:assert/strict')

const {
  getCommerceStore,
  isDeployedNetlifyRuntime,
  isNetlifyProduction,
} = require('../../netlify/lib/storage.cjs')

function withEnv(overrides, fn) {
  const previous = {}
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key]
    const value = overrides[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(overrides)) {
        if (previous[key] === undefined) delete process.env[key]
        else process.env[key] = previous[key]
      }
    })
}

test('deployed Netlify runtime is detected from SITE_ID only', async () => {
  await withEnv({ SITE_ID: undefined, NETLIFY: 'true', CONTEXT: 'production' }, () => {
    assert.equal(isDeployedNetlifyRuntime(), false)
    assert.equal(isNetlifyProduction(), false)
  })

  await withEnv({ SITE_ID: 'site-123' }, () => {
    assert.equal(isDeployedNetlifyRuntime(), true)
    assert.equal(isNetlifyProduction(), true)
  })
})

test('outside Netlify throws and does not use local files', async () => {
  await withEnv({ SITE_ID: undefined, NETLIFY_DEV: undefined }, async () => {
    await assert.rejects(
      () => getCommerceStore(),
      /Commerce storage is unavailable outside Netlify production or local Netlify dev/,
    )
  })
})

test('deployed runtime requires Blobs and never falls back to local files', async () => {
  await withEnv({ SITE_ID: 'site-123', NETLIFY_DEV: undefined }, async () => {
    await assert.rejects(
      () => getCommerceStore(),
      /Netlify Blobs is required in production commerce storage/,
    )
  })
})
