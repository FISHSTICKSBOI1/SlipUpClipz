/**
 * Build the optional Qwen3-TTS 0.6B component. It is not placed inside the app installer.
 * Output defaults to D:\SlipUpClipzBuild so the project drive is not filled.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildRoot = process.env.AI_COMPONENT_BUILD_ROOT || 'D:\\SlipUpClipzBuild'
const stage = path.join(buildRoot, 'ai-component')
const archiveName = 'SlipUpClipz-AI-0.1.6.tar'
const archivePath = path.join(buildRoot, archiveName)
const pythonZip = path.join(buildRoot, 'python-3.11.3-embed-amd64.zip')
const embedUrl = 'https://www.python.org/ftp/python/3.11.3/python-3.11.3-embed-amd64.zip'
const basePython = 'C:\\Users\\FISHS\\AppData\\Local\\Programs\\Python\\Python311'
const sitePackages = path.join(root, 'ai', '.venv', 'Lib', 'site-packages')
const hfHub = path.join(process.env.USERPROFILE || '', '.cache', 'huggingface', 'hub')

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})`)
  }
}

function copyDlls(pythonDir) {
  if (!existsSync(basePython)) return
  for (const name of ['python3.dll', 'sqlite3.dll', 'vcruntime140.dll', 'vcruntime140_1.dll']) {
    const source = path.join(basePython, name)
    const target = path.join(pythonDir, name)
    if (existsSync(source) && !existsSync(target)) cpSync(source, target)
  }
}

function writeNotices(noticeDir) {
  mkdirSync(path.join(noticeDir, 'licenses'), { recursive: true })
  const copies = [
    [path.join(sitePackages, 'qwen_tts-0.1.1.dist-info', 'licenses', 'LICENSE'), 'qwen-tts-apache-2.0.txt'],
    [path.join(sitePackages, 'faster_whisper-1.2.1.dist-info', 'LICENSE'), 'faster-whisper-mit.txt'],
    [path.join(sitePackages, 'torch-2.14.1+cu126.dist-info', 'licenses', 'LICENSE'), 'pytorch-license.txt'],
  ]
  for (const [source, name] of copies) {
    if (existsSync(source)) cpSync(source, path.join(noticeDir, 'licenses', name))
  }
  writeFileSync(
    path.join(noticeDir, 'THIRD-PARTY-NOTICES.txt'),
    `SlipUpClipz AI Voice Clip Cloning component
Model: Qwen/Qwen3-TTS-12Hz-0.6B-Base
The 1.7B checkpoint is not included.

Qwen3-TTS code and the 0.6B Base weights are used under the Apache License 2.0
shipped in licenses/qwen-tts-apache-2.0.txt. Copyright holders are named there.

Local transcription uses faster-whisper (MIT, SYSTRAN) and the Systran
faster-whisper tiny.en weights. See licenses/faster-whisper-mit.txt.

PyTorch ${'2.14.1+cu126'} supplies the GPU runtime libraries used for inference.
Its license is licenses/pytorch-license.txt. This component does not include
the CUDA development toolkit. A current NVIDIA driver is still required.

Python 3.11.3 embeddable package is from python.org and is covered by the
Python Software Foundation License.

These files stay in this AI component folder. They are not copied into the
SlipUpClipz clip profile.
`,
  )
}

async function sha256(file) {
  const hash = createHash('sha256')
  await new Promise((resolve, reject) => {
    const stream = createReadStream(file)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', resolve)
  })
  return hash.digest('hex')
}

if (!existsSync(sitePackages)) throw new Error(`Missing ${sitePackages}`)
mkdirSync(buildRoot, { recursive: true })
mkdirSync(stage, { recursive: true })

if (!existsSync(pythonZip)) {
  console.log('[ai-component] Downloading Python 3.11.3 embeddable')
  run('curl.exe', ['-fL', '--retry', '3', '-o', pythonZip, embedUrl])
}
const pythonDir = path.join(stage, 'python')
if (!existsSync(path.join(pythonDir, 'python.exe'))) {
  mkdirSync(pythonDir, { recursive: true })
  run('tar', ['-xf', pythonZip, '-C', pythonDir])
}
copyDlls(pythonDir)
writeFileSync(path.join(pythonDir, 'python311._pth'), 'python311.zip\n.\nLib\\site-packages\nimport site\n')

const destinationPackages = path.join(pythonDir, 'Lib', 'site-packages')
console.log('[ai-component] Copying Python packages')
const copied = spawnSync(
  'robocopy',
  [sitePackages, destinationPackages, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/XD', '__pycache__', '/XF', '*.pyc'],
  { stdio: 'inherit', windowsHide: true },
)
if ((copied.status ?? 1) >= 8) throw new Error(`robocopy failed (${copied.status})`)

const qwenName = 'models--Qwen--Qwen3-TTS-12Hz-0.6B-Base'
const qwenSource = path.join(hfHub, qwenName)
if (!existsSync(qwenSource)) throw new Error(`Missing ${qwenSource}`)
const qwenDestination = path.join(stage, 'models', 'huggingface', 'hub', qwenName)
console.log('[ai-component] Copying Qwen3-TTS 0.6B')
const qwenCopy = spawnSync('robocopy', [qwenSource, qwenDestination, '/E', '/NFL', '/NDL', '/NJH', '/NJS'], {
  stdio: 'inherit',
  windowsHide: true,
})
if ((qwenCopy.status ?? 1) >= 8) throw new Error(`qwen copy failed (${qwenCopy.status})`)

const whisperSource = path.join(hfHub, 'models--Systran--faster-whisper-tiny.en', 'snapshots')
const whisperSnapshot = existsSync(whisperSource)
  ? path.join(whisperSource, readFileSync(path.join(hfHub, 'models--Systran--faster-whisper-tiny.en', 'refs', 'main'), 'utf8').trim())
  : ''
if (!whisperSnapshot || !existsSync(whisperSnapshot)) throw new Error('Missing faster-whisper tiny.en snapshot')
const whisperDestination = path.join(stage, 'models', 'whisper-tiny.en')
rmSync(whisperDestination, { recursive: true, force: true })
cpSync(whisperSnapshot, whisperDestination, { recursive: true })
writeNotices(path.join(stage, 'NOTICES'))

console.log('[ai-component] Creating archive')
rmSync(archivePath, { force: true })
run('tar', ['-cf', archivePath, '-C', stage, 'python', 'models', 'NOTICES'])
const digest = await sha256(archivePath)
const bytes = statSync(archivePath).size
const pin = {
  id: 'slipupclipz-qwen3-tts-0.6b-base',
  componentVersion: '1',
  model: 'Qwen/Qwen3-TTS-12Hz-0.6B-Base',
  archiveName,
  sha256: digest,
  bytes,
  url: null,
  minFreeBytes: bytes + 9_000_000_000,
}
writeFileSync(path.join(root, 'shared', 'aiComponentPin.json'), `${JSON.stringify(pin, null, 2)}\n`)
console.log(`[ai-component] ${archivePath}`)
console.log(`[ai-component] ${bytes} bytes  sha256 ${digest}`)
