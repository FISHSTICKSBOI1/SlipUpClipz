const { test, after } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { randomUUID } = require('node:crypto')
const dir = mkdtempSync(join(tmpdir(), 'slipup-website-survey-'))
process.env.SLIPUPCLIPZ_FEEDBACK_DIR = dir
delete process.env.SITE_ID
delete process.env.CONTEXT
const { handler } = require('../../netlify/functions/submit-survey.cjs')
const { listSurveyResponses, wrapBlobStore } = require('../../netlify/lib/feedback-store.cjs')
const { validateSurveySubmission } = require('../../netlify/lib/survey.cjs')
after(() => rmSync(dir, {recursive:true,force:true}))
const body=(extra={})=>({startedAt:Date.now()-5000,heardFrom:'youtube',downloadSource:'website',feedback:'Synthetic test feedback',company:'',...extra})
const event=(payload,ip)=>({httpMethod:'POST',body:JSON.stringify(payload),headers:{'x-nf-client-connection-ip':ip}})

test('simultaneous retries store exactly one immutable response and do not spend five rate-limit slots', async()=>{
 const payload=body({submissionId:randomUUID()})
 const results=await Promise.all(Array.from({length:8},()=>handler(event(payload,'203.0.113.101'))))
 assert.ok(results.every(r=>r.statusCode===200))
 assert.equal((await listSurveyResponses()).responses.length,1)
 assert.equal((await handler(event({...payload,feedback:'Must not overwrite original'},'203.0.113.101'))).statusCode,409)
 assert.equal((await listSurveyResponses()).responses[0].feedback,'Synthetic test feedback')
 for(let i=0;i<4;i++) assert.equal((await handler(event(body({submissionId:randomUUID()}),'203.0.113.101'))).statusCode,200)
 assert.equal((await handler(event(body({submissionId:randomUUID()}),'203.0.113.101'))).statusCode,429)
})

test('concurrent distinct submissions respect five-per-network rate limit',async()=>{
 const results=await Promise.all(Array.from({length:12},()=>handler(event(body({submissionId:randomUUID()}),'203.0.113.102'))))
 assert.equal(results.filter(r=>r.statusCode===200).length,5)
 assert.equal(results.filter(r=>r.statusCode===429).length,7)
})

test('rejects malformed IDs, nonstring answers, oversized bodies, and deployed local fallback',async()=>{
 assert.equal(validateSurveySubmission(body({submissionId:'../escape'})).ok,false)
 assert.equal(validateSurveySubmission(body({feedback:{value:'bad'}})).ok,false)
 assert.equal((await handler(event(body({feedback:'x'.repeat(9000)}),'203.0.113.103'))).statusCode,413)
 process.env.CONTEXT='production'; process.env.SURVEY_IP_SALT='synthetic-test-salt'
 try { assert.equal((await handler(event(body(),'203.0.113.104'))).statusCode,503) }
 finally {delete process.env.CONTEXT; delete process.env.SURVEY_IP_SALT}
})

test('actual installed Blobs adapter sends conditional headers and strong reads',async()=>{
 const { getStore }=require('@netlify/blobs')
 const original=global.fetch
 const requests=[]
 global.fetch=async (input,init={})=>{
   const headers=new Headers(init.headers); requests.push({method:init.method,headers})
   if(init.method.toUpperCase()==='PUT') return new Response(null,{status:200,headers:{etag:'test-etag'}})
   return new Response('{"hits":[]}',{status:200,headers:{etag:'test-etag'}})
 }
 try {
   const store=wrapBlobStore((fetch) => getStore('survey-test',{fetch,siteID:'synthetic',token:'synthetic',edgeURL:'https://blobs.example.test',uncachedEdgeURL:'https://strong.blobs.example.test'}))
   await store.setJSON('one',{value:1},{onlyIfNew:true})
   await store.setJSON('one',{value:2},{onlyIfMatch:'test-etag'})
   await store.getWithMetadata('one')
   assert.equal(requests[0].headers.get('if-none-match'),'*')
   assert.equal(requests[1].headers.get('if-match'),'test-etag')
 } finally {global.fetch=original}
})

test('deployed Functions require a private salt even without build CONTEXT', async()=>{
 const originalFetch=global.fetch
 process.env.SITE_ID='synthetic-deployed-site'
 delete process.env.CONTEXT
 delete process.env.SURVEY_IP_SALT
 global.fetch=async()=>{throw new Error('must not reach a real service')}
 try {
   const response=await handler(event(body(),'203.0.113.105'))
   assert.equal(response.statusCode,503)
   assert.equal(JSON.parse(response.body).error,'Survey submissions are unavailable on this deployment. Your answers were not saved.')
 } finally {delete process.env.SITE_ID;global.fetch=originalFetch}
})


test('survey CAS accepts only confirmed writes or genuine conflicts, failing closed on uncertainty', async()=>{
 const { getStore }=require('@netlify/blobs')
 const original=global.fetch
 try {
   for (const outcome of [200,412,400,403,500,202,'network']) {
     for (const condition of [{onlyIfNew:true},{onlyIfMatch:'synthetic-etag'}]) {
       let calls=0
       global.fetch=async()=>{calls++; if(outcome==='network') throw new Error('synthetic network failure'); return new Response(null,{status:outcome})}
       const store=wrapBlobStore(fetch=>getStore('survey-test',{fetch,siteID:'synthetic',token:'synthetic',edgeURL:'https://blobs.example.test'}))
       if(outcome===200 || outcome===412) assert.equal((await store.setJSON('synthetic',{},condition)).modified,outcome===200)
       else await assert.rejects(store.setJSON('synthetic',{},condition),/could not be confirmed/)
       assert.equal(calls,1,'uncertain writes must not be retried')
     }
   }
 } finally {global.fetch=original}
})


test('Lambda preview uses the private Blobs store and confirms feedback before success', async () => {
  const originalFetch = global.fetch
  const originalContext = process.env.NETLIFY_BLOBS_CONTEXT
  const records = new Map()
  const payload = body({ submissionId: randomUUID() })
  const request = {
    ...event(payload, '203.0.113.106'),
    blobs: Buffer.from(JSON.stringify({ url: 'https://blobs.example.test', token: 'synthetic' })).toString('base64'),
  }
  Object.assign(request.headers, { 'x-nf-site-id': 'synthetic-site', 'x-nf-deploy-id': 'synthetic-deploy' })
  let failResponseWrite = false
  global.fetch = async (input, init) => {
    const url = new URL(input)
    assert.equal(url.origin, 'https://blobs.example.test')
    assert.match(url.pathname, /^\/synthetic-site\/site:slipupclipz-feedback\//)
    const key = decodeURIComponent(url.pathname).split('/').at(-1)
    const existing = records.get(key)
    if (init.method.toUpperCase() === 'GET') {
      return new Response(existing ?? null, { status: existing ? 200 : 404, headers: { etag: 'fixture-version' } })
    }
    assert.equal(init.method.toUpperCase(), 'PUT')
    const headers = new Headers(init.headers)
    assert.equal(headers.get(existing ? 'if-match' : 'if-none-match'), existing ? 'fixture-version' : '*')
    if (failResponseWrite && key.startsWith('response:')) return new Response(null, { status: 500 })
    records.set(key, init.body)
    return new Response(null, { status: 200 })
  }

  try {
    delete process.env.SURVEY_IP_SALT
    const missingSalt = await handler(request)
    assert.equal(missingSalt.statusCode, 503)
    assert.equal(JSON.parse(missingSalt.body).ok, undefined)
    assert.equal(records.size, 0)

    process.env.SURVEY_IP_SALT = 'synthetic-preview-salt'
    failResponseWrite = true
    const failedSave = await handler(request)
    assert.equal(failedSave.statusCode, 503)
    assert.match(JSON.parse(failedSave.body).error, /could not confirm/)
    assert.equal(failedSave.headers['Set-Cookie'], undefined)
    assert.equal([...records.keys()].filter(key => key.startsWith('response:')).length, 0)

    failResponseWrite = false
    const successfulRetry = await handler(request)
    assert.equal(successfulRetry.statusCode, 200)
    assert.deepEqual(JSON.parse(successfulRetry.body), { ok: true })
    const responses = [...records].filter(([key]) => key.startsWith('response:'))
    assert.equal(responses.length, 1)
    assert.equal(JSON.parse(responses[0][1]).feedback, payload.feedback)
  } finally {
    delete process.env.SURVEY_IP_SALT
    if (originalContext === undefined) delete process.env.NETLIFY_BLOBS_CONTEXT
    else process.env.NETLIFY_BLOBS_CONTEXT = originalContext
    global.fetch = originalFetch
  }
})
