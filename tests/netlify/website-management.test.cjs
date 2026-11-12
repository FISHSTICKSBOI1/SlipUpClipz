const {test}=require('node:test')
const assert=require('node:assert/strict')
const {issueBillingRecovery, consumeRecoveryRateLimit}=require('../../netlify/lib/billing-recovery.cjs')
const {redeemBillingRecovery}=require('../../netlify/functions/billing-recovery-redeem.cjs')
const {buildBillingRecoveryEmail}=require('../../netlify/lib/email.cjs')
function store(){
 const records=new Map();let version=0
 return {
  async getJSON(key){return structuredClone(records.get(key)?.data||null)},
  async getWithMetadata(key){return structuredClone(records.get(key)||null)},
  async setJSON(key,data,options={}){
   const old=records.get(key)
   if(options.onlyIfNew && old)return {modified:false}
   if(options.onlyIfMatch && old?.etag!==options.onlyIfMatch)return {modified:false}
   records.set(key,{data:structuredClone(data),etag:String(++version)});return {modified:true}
  }
 }
}
const license={licenseKey:'SLIP-TEST-TEST-TEST',email:'synthetic@example.test',stripeCustomerId:'cus_synthetic'}
const event=token=>({httpMethod:'POST',body:JSON.stringify({token})})
test('management link permits one portal session under concurrent redemption',async()=>{
 const repo=store(); const {token}=await issueBillingRecovery({store:repo,license})
 let sessions=0
 const deps={store:repo,getLicense:async()=>license,stripe:{billingPortal:{sessions:{async create(params){sessions++;assert.equal(params.customer,license.stripeCustomerId);return {url:'https://billing.stripe.com/p/session_test'}}}}}}
 const results=await Promise.all(Array.from({length:8},()=>redeemBillingRecovery(event(token),deps)))
 assert.equal(sessions,1);assert.equal(results.filter(r=>r.statusCode===200).length,1)
 assert.equal((await redeemBillingRecovery(event(token),deps)).statusCode,400)
})
test('expiry, changed ownership, malformed tokens and upstream failure fail closed',async()=>{
 const repo=store();let sessions=0
 const deps={store:repo,getLicense:async()=>license,stripe:{billingPortal:{sessions:{async create(){sessions++;throw new Error('do not disclose upstream secrets')}}}}}
 const expired=await issueBillingRecovery({store:repo,license,now:new Date(Date.now()-7200000)})
 assert.equal((await redeemBillingRecovery(event(expired.token),deps)).statusCode,400)
 const mismatch=await issueBillingRecovery({store:repo,license})
 assert.equal((await redeemBillingRecovery(event(mismatch.token),{...deps,getLicense:async()=>({...license,email:'other@example.test'})})).statusCode,400)
 assert.equal((await redeemBillingRecovery(event('no'),deps)).statusCode,400)
 assert.equal(sessions,0)
 const valid=await issueBillingRecovery({store:repo,license})
 const failed=await redeemBillingRecovery(event(valid.token),deps)
 assert.equal(failed.statusCode,503);assert.ok(!failed.body.includes('secrets'))
 assert.equal((await redeemBillingRecovery(event(valid.token),deps)).statusCode,400)
})
test('recovery email accurately describes management, license recovery and expiration',()=>{
 const email=buildBillingRecoveryEmail({licenseKey:license.licenseKey,recoveryUrl:'https://example.test/pricing?billing=synthetic'})
 assert.match(email.subject,/Manage/);assert.match(email.text,/license key/);assert.match(email.text,/60 minutes/)
 assert.match(email.text,/manage or cancel/)
})

test('concurrent recovery reservations honor both limits on new and legacy records', async () => {
  const repo = store()
  const now = Date.now()
  for (const [key, limit, priorHits] of [['email', 5, 0], ['ip', 8, 2]]) {
    if (priorHits) await repo.setJSON(key, { hits: [0, ...Array(priorHits).fill(now - 1000)] })
    const outcomes = await Promise.all(Array.from({ length: 16 }, () =>
      consumeRecoveryRateLimit(repo, key, now, limit)
    ))
    assert.equal(outcomes.filter(({ allowed }) => allowed).length, limit - priorHits)
    assert.equal((await repo.getJSON(key)).hits.length, limit)
  }
})

test('recovery reservations fail closed without a version or a successful conditional write', async () => {
  let writes = 0
  const repo = {
    async getJSON() { return { hits: [] } },
    async getWithMetadata() { return { data: { hits: [] } } },
    async setJSON() { writes += 1; return { modified: false } },
  }
  assert.deepEqual(await consumeRecoveryRateLimit(repo, 'email'), { allowed: false })
  assert.equal(writes, 0)
  repo.getWithMetadata = async () => ({ data: { hits: [] }, etag: 'version' })
  assert.deepEqual(await consumeRecoveryRateLimit(repo, 'email'), { allowed: false })
  assert.ok(writes > 0 && writes <= 12)
})

function mockCommerceBlobs(t, respond) {
  const siteId = process.env.SITE_ID
  const context = globalThis.netlifyBlobsContext
  process.env.SITE_ID = 'synthetic-site'
  globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify({
    siteID: 'synthetic-site', token: 'synthetic-token', edgeURL: 'https://blobs.example.test',
  })).toString('base64')
  t.after(() => {
    if (siteId === undefined) delete process.env.SITE_ID
    else process.env.SITE_ID = siteId
    if (context === undefined) delete globalThis.netlifyBlobsContext
    else globalThis.netlifyBlobsContext = context
  })
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(new URL(url).origin, 'https://blobs.example.test')
    return respond(new URL(url), options)
  })
}

test('actual Blobs SDK retries a genuine 412 and grants quota after a confirmed 200', async (t) => {
  const { getCommerceStore } = require('../../netlify/lib/storage.cjs')
  let writes = 0
  mockCommerceBlobs(t, (_url, options) => {
    if (options.method === 'get') {
      if (!writes) return new Response(null, { status: 404 })
      return new Response(JSON.stringify({ hits: [] }), { headers: { etag: '"current"' } })
    }
    const headers = new Headers(options.headers)
    writes += 1
    if (writes === 1) {
      assert.equal(headers.get('if-none-match'), '*')
      return new Response(null, { status: 412 })
    }
    assert.equal(headers.get('if-match'), '"current"')
    return new Response(null, { status: 200, headers: { etag: '"updated"' } })
  })
  assert.deepEqual(await consumeRecoveryRateLimit(await getCommerceStore(), 'quota'), { allowed: true })
  assert.equal(writes, 2)
})

for (const endpoint of ['billing-recovery', 'device-transfer']) {
  test(endpoint + ' stops before issuance or email on failed or uncertain quota storage', async (t) => {
    const { handler } = require('../../netlify/functions/' + endpoint + '.cjs')
    const request = { httpMethod: 'POST', body: JSON.stringify({ ...license, deviceId: 'a'.repeat(64) }) }
    let failure
    let calls = []
    mockCommerceBlobs(t, (url, options) => {
      calls.push([url.pathname, options.method])
      assert.match(url.pathname, /-rate:(ip|email):/)
      if (options.method === 'get') return new Response(null, { status: failure === 'read' ? 403 : 404 })
      assert.equal(new Headers(options.headers).get('if-none-match'), '*')
      if (url.pathname.includes('-rate:ip:')) return new Response(null, { status: 200 })
      if (failure === 'lost response') throw new Error('synthetic network details')
      return new Response(null, { status: failure })
    })
    for (failure of [400, 403, 500, 202, 'lost response', 'read']) {
      calls = []
      const response = await handler(request)
      assert.equal(response.statusCode, 503, String(failure))
      assert.doesNotMatch(response.body, /synthetic|blobs/i)
      assert.equal(calls.length, failure === 'read' ? 1 : 4)
      assert.ok(calls.every(([path]) => /-rate:(ip|email):/.test(path)))
    }
  })
}
