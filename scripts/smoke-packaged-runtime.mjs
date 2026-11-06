/**
 * Starts the voice engine with the portable runtime and the packaged server files.
 * This does not install the app and does not use the development virtual environment.
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const python = process.env.SLIPUPCLIPZ_AI_PYTHON || 'D:\\SlipUpClipzBuild\\ai-component\\python\\python.exe'
const serverDir = process.env.SLIPUPCLIPZ_AI_SERVER_DIR || path.join(root, 'release', 'win-unpacked', 'resources', 'ai-app')
const component = 'D:\\SlipUpClipzBuild\\ai-component'
const token = 'packaged-runtime-smoke'
const reference = path.join(root, 'ai', 'benchmark-duration', 'ref-1s.wav')

const child = spawn(python, ['-u', '-m', 'uvicorn', 'server:app', '--host', '127.0.0.1', '--port', '8765'], {
  cwd: serverDir,
  windowsHide: true,
  env: {
    ...process.env,
    SLIPUPCLIPZ_AI_TOKEN: token,
    PYTHONNOUSERSITE: '1',
    HF_HOME: path.join(component, 'models', 'huggingface'),
    HUGGINGFACE_HUB_CACHE: path.join(component, 'models', 'huggingface', 'hub'),
    HF_HUB_OFFLINE: '1',
    TRANSFORMERS_OFFLINE: '1',
    HF_HUB_DISABLE_TELEMETRY: '1',
    SLIPUPCLIPZ_WHISPER_MODEL: path.join(component, 'models', 'whisper-tiny.en'),
    SLIPUPCLIPZ_AI_OUTPUT: path.join('D:\\SlipUpClipzBuild', 'ai-smoke', 'outputs'),
  },
})

let log = ''
child.stdout.on('data', (chunk) => {
  log += chunk.toString()
  process.stdout.write(chunk)
})
child.stderr.on('data', (chunk) => {
  log += chunk.toString()
  process.stderr.write(chunk)
})

function stop() {
  if (child.pid) spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
}

async function waitReady() {
  const deadline = Date.now() + 180000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Worker exited ${child.exitCode}`)
    try {
      const response = await fetch('http://127.0.0.1:8765/health', {
        headers: { 'X-SlipUpClipz-Worker': token },
      })
      if (response.ok) {
        const body = await response.json()
        if (body.status === 'ready' && body.model === 'Qwen3-TTS-0.6B' && body.authorized === true) return body
      }
    } catch {
      // The model is still loading.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('Worker did not become ready')
}

try {
  const health = await waitReady()
  console.log('[smoke] health', JSON.stringify(health))
  const wav = readFileSync(reference)
  const form = new FormData()
  form.append('reference_audio', new Blob([wav], { type: 'audio/wav' }), 'reference.wav')
  form.append('text', 'Bro, I cannot believe that actually worked.')
  form.append('ref_text', "I'm by the door.")
  form.append('temporary', '1')
  const response = await fetch('http://127.0.0.1:8765/generate-from-clip', {
    method: 'POST',
    headers: {
      'X-SlipUpClipz-Client': 'electron',
      'X-SlipUpClipz-Worker': token,
    },
    body: form,
    signal: AbortSignal.timeout(180000),
  })
  if (!response.ok) throw new Error(`Generation HTTP ${response.status}: ${await response.text()}`)
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength < 1000) throw new Error(`Generation was too small (${bytes.byteLength} bytes)`)
  console.log(`[smoke] generated ${bytes.byteLength} bytes`)
} catch (error) {
  console.error('[smoke] failed', error instanceof Error ? error.message : error)
  console.error(log.slice(-2000))
  stop()
  process.exitCode = 1
} finally {
  stop()
}
