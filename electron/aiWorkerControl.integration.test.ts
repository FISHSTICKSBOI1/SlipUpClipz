import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  AiWorkerController,
  localPortBusy,
  probeAiServer,
  resolveAiRuntime,
  startUvicornWorker,
  type WorkerSession,
} from './aiWorkerControl.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reference = path.join(root, 'ai', 'benchmark-duration', 'ref-1s.wav')

function gpuUsed(): number {
  const text = execFileSync(
    'nvidia-smi',
    ['--query-gpu=memory.used', '--format=csv,noheader,nounits'],
    { encoding: 'utf8', timeout: 10000 },
  )
  return Number(text.trim().split(/\r?\n/)[0])
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generate(session: WorkerSession): Promise<void> {
  const wav = readFileSync(reference)
  const form = new FormData()
  form.append('reference_audio', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'reference.wav')
  form.append('text', "Bro, I can't believe that actually worked. We need to try that again!")
  form.append('ref_text', "I'm by the door.")
  form.append('temporary', '1')
  const response = await fetch(`${session.url}/generate-from-clip`, {
    method: 'POST',
    headers: {
      'X-SlipUpClipz-Client': 'electron',
      'X-SlipUpClipz-Worker': session.token,
    },
    body: form,
    signal: AbortSignal.timeout(180000),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Generation failed HTTP ${response.status}: ${detail}`)
  }
  const bytes = await response.arrayBuffer()
  assert.ok(bytes.byteLength > 1000)
}

describe('AI worker process', () => {
  it('loads, generates twice, unloads, reloads, and recovers from a crash', { timeout: 300000 }, async () => {
    const existing = await localPortBusy()
    assert.equal(
      existing,
      false,
      'Port 8765 is already in use. The test left that program running.',
    )
    const runtime = resolveAiRuntime(root)
    assert.equal(runtime.pythonPath.endsWith('python.exe'), true)
    const samples: Record<string, number> = { before: gpuUsed() }
    const worker = new AiWorkerController({
      canStart: () => true,
      idleMs: 8_000,
      probe: probeAiServer,
      spawn: (token) => startUvicornWorker(runtime, (line) => {
        worker.remember(line)
        console.log(`[ai-worker] ${line}`)
      }, token),
      log: (line) => console.log(`[ai-worker] ${line}`),
    })
    try {
      await worker.run(true, async (session) => {
        samples.during = gpuUsed()
        await generate(session)
        await generate(session)
      })
      samples.afterRequests = gpuUsed()
      assert.equal(worker.status().owned, true)
      const firstPid = worker.status().pid
      const idleDeadline = Date.now() + 25_000
      while (worker.status().owned && Date.now() < idleDeadline) await wait(250)
      assert.equal(worker.status().owned, false)
      const releaseDeadline = Date.now() + 20_000
      samples.afterIdle = gpuUsed()
      while (samples.afterIdle > samples.before + 400 && Date.now() < releaseDeadline) {
        await wait(500)
        samples.afterIdle = gpuUsed()
      }
      await worker.run(true, async (session) => {
        samples.reloaded = gpuUsed()
        await generate(session)
      })
      const reloadedPid = worker.status().pid
      assert.notEqual(reloadedPid, firstPid)
      assert.ok(reloadedPid)
      process.kill(reloadedPid)
      const crashDeadline = Date.now() + 15_000
      while (worker.status().owned && Date.now() < crashDeadline) await wait(200)
      await worker.run(true, (session) => generate(session))
      assert.notEqual(worker.status().pid, reloadedPid)
      await worker.shutdown()
      const exitDeadline = Date.now() + 20_000
      samples.afterExit = gpuUsed()
      while (samples.afterExit > samples.before + 400 && Date.now() < exitDeadline) {
        await wait(500)
        samples.afterExit = gpuUsed()
      }
      console.log(`GPU_MIB ${JSON.stringify(samples)}`)
      assert.ok(samples.during > samples.before + 1000, `GPU did not rise during load: ${JSON.stringify(samples)}`)
      assert.ok(samples.afterIdle <= samples.before + 400, `GPU did not release after idle: ${JSON.stringify(samples)}`)
      assert.ok(samples.afterExit <= samples.before + 400, `GPU did not release on shutdown: ${JSON.stringify(samples)}`)
    } finally {
      await worker.shutdown()
    }
  })
})
