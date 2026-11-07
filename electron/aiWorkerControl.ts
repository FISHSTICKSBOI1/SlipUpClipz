import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'

const SESSION_TEMP_WAV = /^tmp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{32}\.wav$/i

export const AI_SERVER_URL = 'http://127.0.0.1:8765'
export const DEFAULT_IDLE_MS = 120_000
export const DEFAULT_STARTUP_MS = 90_000
/** How long to wait for an owned worker to answer before refusing to replace it. */
export const REUSE_PROBE_MS = 20_000
export const AI_WORKER_CLAIM = 'ai-worker.claim'
export const PORT_IN_USE_MESSAGE =
  'Another program is using the local AI port. SlipUpClipz will not send your recording there and will not stop that program.'
export const AI_GENERATION_STOPPED = 'AI Clone generation was stopped.'

export type EngineRestartResult =
  | { ok: true }
  | { ok: false; code: 'busy' | 'foreign' | 'failed'; message: string }
const PRODUCTION_MODEL = 'Qwen3-TTS-0.6B'
const READY_LINE = 'Uvicorn running on http://127.0.0.1:8765'

export type WorkerProbe =
  | { state: 'down' }
  | { state: 'ready'; model: string }
  | { state: 'occupied' }

export type OwnedProcess = {
  pid: number | undefined
  kill: () => void
  exited: Promise<number | null>
}

export type AiRuntimeSource = 'development' | 'component' | 'bundled' | 'missing'

export type AiRuntime = {
  pythonPath: string
  aiDir: string
  serverPath: string
  source: AiRuntimeSource
  modelHome: string
  whisperPath: string
  logDir: string
}

export type AiRuntimeOptions = {
  packaged?: boolean
  resourcesPath?: string
  componentRoot?: string
  logDir?: string
}

export type WorkerSession = {
  url: string
  token: string
}

export type AiWorkerHooks = {
  canStart: () => boolean
  portBusy?: () => Promise<boolean>
  probe: (token: string) => Promise<WorkerProbe>
  spawn: (token: string) => OwnedProcess
  waitForReadyLine?: boolean
  idleMs?: number
  startupMs?: number
  /** Wait for a live owned worker before deciding it is unavailable. */
  reuseMs?: number
  /** Exclusive claim. `held` means some other live engine already reserved startup. */
  claim?: () => Promise<'acquired' | 'held'> | 'acquired' | 'held'
  releaseClaim?: () => void
  /** True when a live claim exists that this controller must not take over. */
  peekClaim?: () => Promise<boolean> | boolean
  noteWorkerPid?: (pid: number | undefined) => void
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  log?: (line: string) => void
}

function runtimeFrom(
  source: AiRuntimeSource,
  pythonPath: string,
  aiDir: string,
  runtimeRoot: string,
  logDir: string,
): AiRuntime {
  return {
    source,
    pythonPath,
    aiDir,
    serverPath: path.join(aiDir, 'server.py'),
    modelHome: runtimeRoot ? path.join(runtimeRoot, 'models', 'huggingface') : '',
    whisperPath: runtimeRoot ? path.join(runtimeRoot, 'models', 'whisper-tiny.en') : '',
    logDir,
  }
}

/**
 * Packaged builds use the installed component or the runtime shipped inside the
 * Store package. They do not use a development virtual environment.
 */
export function resolveAiRuntime(appRoot: string, options: AiRuntimeOptions = {}): AiRuntime {
  const packaged = options.packaged === true
  const resources = options.resourcesPath ?? ''
  const aiDir = packaged && resources ? path.join(resources, 'ai-app') : path.join(appRoot, 'ai')
  const logDir = options.logDir || path.join(aiDir, 'logs')

  if (packaged) {
    const componentRoot = options.componentRoot ?? ''
    const componentPython = path.join(componentRoot, 'python', 'python.exe')
    if (componentRoot && existsSync(path.join(componentRoot, 'COMPLETE')) && existsSync(componentPython)) {
      return runtimeFrom('component', componentPython, aiDir, componentRoot, logDir)
    }
    const bundledRoot = resources ? path.join(resources, 'ai-runtime') : ''
    const bundledPython = path.join(bundledRoot, 'python', 'python.exe')
    if (
      bundledRoot &&
      existsSync(bundledPython) &&
      existsSync(path.join(bundledRoot, 'models', 'huggingface', 'hub'))
    ) {
      return runtimeFrom('bundled', bundledPython, aiDir, bundledRoot, logDir)
    }
    return runtimeFrom('missing', '', aiDir, '', logDir)
  }

  const preferred = process.env.SLIPUPCLIPZ_AI_PYTHON
  const candidates = [
    preferred,
    path.join(aiDir, '.venv', 'Scripts', 'python.exe'),
    process.resourcesPath
      ? path.join(process.resourcesPath, 'ai', '.venv', 'Scripts', 'python.exe')
      : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate))
  const pythonPath = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0] ?? ''
  return runtimeFrom('development', pythonPath, aiDir, '', logDir)
}

export function aiOutputDirectoryFor(runtime: Pick<AiRuntime, 'source' | 'aiDir' | 'logDir'>): string {
  if (runtime.source !== 'development' && runtime.logDir) {
    return path.join(path.dirname(runtime.logDir), 'outputs')
  }
  return path.join(runtime.aiDir, 'outputs')
}

/** Delete only this session's tmp WAVs. Reference recordings and other sessions stay. */
export function removeOwnedSessionTemps(outputDir: string, sessionId: string): string[] {
  if (!outputDir || !sessionId || !existsSync(outputDir)) return []
  const root = path.resolve(outputDir)
  const removed: string[] = []
  let names: string[] = []
  try {
    names = readdirSync(root)
  } catch {
    return removed
  }
  for (const name of names) {
    if (!SESSION_TEMP_WAV.test(name) || !name.toLowerCase().startsWith(`tmp-${sessionId.toLowerCase()}-`)) continue
    const full = path.resolve(root, name)
    if (path.dirname(full) !== root) continue
    try {
      unlinkSync(full)
      removed.push(name)
    } catch {
      // A file still open in the worker is left for the later orphan scan.
    }
  }
  return removed
}

export function localPortBusy(port = 8765): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    let settled = false
    const finish = (busy: boolean) => {
      if (settled) return
      settled = true
      socket.removeAllListeners()
      socket.destroy()
      resolve(busy)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    // A timeout is not a free port. The owned worker can be blocked in GPU
    // inference and not accept() yet. Treating that as free starts a second engine.
    socket.setTimeout(800, () => finish(true))
  })
}

type WorkerClaimRecord = { ownerPid: number; workerPid: number }

export function workerClaimPath(directory: string): string {
  return path.join(directory, AI_WORKER_CLAIM)
}

function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : ''
    return code === 'EPERM'
  }
}

function readWorkerClaim(directory: string): WorkerClaimRecord | null {
  try {
    const parsed = JSON.parse(readFileSync(workerClaimPath(directory), 'utf8')) as Partial<WorkerClaimRecord>
    const ownerPid = Number(parsed.ownerPid)
    const workerPid = Number(parsed.workerPid)
    if (!Number.isInteger(ownerPid)) return null
    return { ownerPid, workerPid: Number.isInteger(workerPid) ? workerPid : 0 }
  } catch {
    return null
  }
}

function claimIsHeld(record: WorkerClaimRecord): boolean {
  const foreignOwner = pidAlive(record.ownerPid) && record.ownerPid !== process.pid
  const workerAlive = pidAlive(record.workerPid)
  return foreignOwner || workerAlive
}

/** True when a live SlipUpClipz engine this process does not own has reserved startup. */
export function workerClaimHeld(directory: string): boolean {
  const existing = readWorkerClaim(directory)
  if (!existing) return false
  return claimIsHeld(existing)
}

/**
 * Reserve startup before spawning. A live owner or worker pid is left untouched.
 * A dead claim is removed. This never signals another process except the
 * existence check (signal 0).
 */
export function acquireWorkerClaim(directory: string): 'acquired' | 'held' {
  mkdirSync(directory, { recursive: true })
  const file = workerClaimPath(directory)
  const existing = readWorkerClaim(directory)
  if (existing) {
    if (claimIsHeld(existing)) return 'held'
    try {
      unlinkSync(file)
    } catch {
      return 'held'
    }
  }
  try {
    writeFileSync(file, JSON.stringify({ ownerPid: process.pid, workerPid: 0 }), { flag: 'wx' })
    return 'acquired'
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : ''
    if (code === 'EEXIST') {
      const raced = readWorkerClaim(directory)
      if (raced && claimIsHeld(raced)) return 'held'
    }
    return 'held'
  }
}

export function updateWorkerClaim(directory: string, workerPid: number | undefined): void {
  if (!workerPid) return
  const existing = readWorkerClaim(directory)
  if (!existing || existing.ownerPid !== process.pid) return
  writeFileSync(workerClaimPath(directory), JSON.stringify({ ownerPid: process.pid, workerPid }))
}

/** Remove only a claim this process created, and only after its worker pid is gone. */
export function releaseWorkerClaim(directory: string): void {
  const existing = readWorkerClaim(directory)
  if (!existing || existing.ownerPid !== process.pid) return
  if (pidAlive(existing.workerPid)) return
  try {
    unlinkSync(workerClaimPath(directory))
  } catch {
    // The next acquire treats a leftover dead claim as stale.
  }
}

export async function probeAiServer(token: string): Promise<WorkerProbe> {
  try {
    const response = await fetch(`${AI_SERVER_URL}/health`, {
      headers: { 'X-SlipUpClipz-Worker': token },
      signal: AbortSignal.timeout(2500),
    })
    if (!response.ok) return { state: 'occupied' }
    const body = await response.json() as { status?: unknown; model?: unknown; authorized?: unknown }
    if (body.status === 'ready' && body.model === PRODUCTION_MODEL && body.authorized === true) {
      return { state: 'ready', model: PRODUCTION_MODEL }
    }
    return { state: 'occupied' }
  } catch {
    return { state: 'down' }
  }
}

export function startUvicornWorker(
  runtime: AiRuntime,
  onLine: (line: string) => void,
  token: string,
): OwnedProcess {
  const logDir = runtime.logDir || path.join(runtime.aiDir, 'logs')
  mkdirSync(logDir, { recursive: true })
  const logStream = createWriteStream(path.join(logDir, 'ai-worker.log'), { flags: 'a' })
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SLIPUPCLIPZ_AI_TOKEN: token,
    PYTHONNOUSERSITE: '1',
    PYTHONDONTWRITEBYTECODE: '1',
  }
  if (runtime.modelHome) {
    env.HF_HOME = runtime.modelHome
    env.HUGGINGFACE_HUB_CACHE = path.join(runtime.modelHome, 'hub')
    env.HF_HUB_OFFLINE = '1'
    env.TRANSFORMERS_OFFLINE = '1'
    env.HF_HUB_DISABLE_TELEMETRY = '1'
  }
  if (runtime.whisperPath) env.SLIPUPCLIPZ_WHISPER_MODEL = runtime.whisperPath
  if (runtime.source !== 'development') {
    env.SLIPUPCLIPZ_AI_OUTPUT = path.join(path.dirname(logDir), 'outputs')
  }
  const child = spawn(
    runtime.pythonPath,
    ['-u', '-m', 'uvicorn', 'server:app', '--host', '127.0.0.1', '--port', '8765'],
    {
      cwd: runtime.aiDir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    },
  )
  const write = (chunk: Buffer | string) => {
    const text = chunk.toString()
    logStream.write(text)
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (trimmed) onLine(trimmed)
    }
  }
  child.stdout?.on('data', write)
  child.stderr?.on('data', write)
  let settle: (code: number | null) => void = () => {}
  const exited = new Promise<number | null>((resolve) => {
    settle = resolve
  })
  let settled = false
  const finish = (code: number | null) => {
    if (settled) return
    settled = true
    logStream.end()
    settle(code)
  }
  child.once('exit', (code) => finish(code))
  child.once('error', () => finish(null))
  return {
    pid: child.pid,
    exited,
    kill: () => stopOwnedProcess(child, finish),
  }
}

function stopOwnedProcess(child: ChildProcess, finish: (code: number | null) => void): void {
  if (child.exitCode !== null || child.signalCode !== null) {
    finish(child.exitCode)
    return
  }
  const timer = setTimeout(() => {
    if (child.exitCode === null && child.pid) {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    }
  }, 5000)
  child.once('exit', () => clearTimeout(timer))
  try {
    child.kill()
  } catch {
    finish(child.exitCode)
  }
}

export class AiWorkerController {
  private owned: OwnedProcess | null = null
  private token: string | null = null
  private active = 0
  private ready = false
  private readyLineSeen = false
  private claimOwned = false
  private workerGeneration = 0
  private closed = false
  private chain: Promise<void> = Promise.resolve()
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private idleEpoch = 0
  private recent: string[] = []
  private loadingNotice: (() => void) | undefined
  private cancellation = 0
  private readonly hooks: AiWorkerHooks

  constructor(hooks: AiWorkerHooks) {
    this.hooks = hooks
  }

  status(): { owned: boolean; active: number; pid: number | undefined } {
    return {
      owned: this.owned !== null,
      active: this.active,
      pid: this.owned?.pid,
    }
  }

  async health(): Promise<{ ready: boolean; message?: string }> {
    if (this.owned && this.token) {
      const probe = await this.hooks.probe(this.token)
      if (probe.state === 'ready') return { ready: true }
      if (probe.state === 'occupied') return { ready: false, message: PORT_IN_USE_MESSAGE }
      return { ready: false, message: 'The voice engine is still starting. Try again in a moment.' }
    }
    if (await this.isPortBusy()) {
      return { ready: false, message: PORT_IN_USE_MESSAGE }
    }
    if (this.hooks.peekClaim && await this.hooks.peekClaim()) {
      return { ready: false, message: PORT_IN_USE_MESSAGE }
    }
    if (!this.hooks.canStart()) {
      return {
        ready: false,
        message: 'AI Voice Clip Cloning is not installed. The rest of SlipUpClipz still works. Install the voice engine from Settings on a website installation, or use the Microsoft Store package that includes it.',
      }
    }
    return { ready: true }
  }

  async run<T>(
    consent: boolean,
    operation: (session: WorkerSession) => Promise<T>,
    notice?: { onLoading?: () => void },
  ): Promise<T> {
    return this.enqueue(async () => {
      if (this.closed) throw new Error('AI Clone is shutting down.')
      if (!consent) throw new Error('Speaker permission is required before AI Clone can start.')
      this.active += 1
      this.clearIdle()
      this.loadingNotice = notice?.onLoading
      try {
        const session = await this.ensure()
        return await operation(session)
      } finally {
        this.loadingNotice = undefined
        this.active = Math.max(0, this.active - 1)
        this.scheduleIdle()
      }
    })
  }

  async shutdown(): Promise<void> {
    this.closed = true
    this.clearIdle()
    await this.stopOwned()
  }

  /**
   * Stop the worker this controller spawned and start one replacement.
   * A request that is still running is left alone. An unknown process on the
   * AI port is never signaled.
   */
  async restartOwnedEngine(): Promise<EngineRestartResult> {
    if (this.active > 0) {
      return { ok: false, code: 'busy', message: 'The voice engine is still working. Try again in a moment.' }
    }
    return this.enqueue(async () => {
      if (this.closed) return { ok: false, code: 'failed', message: 'AI Clone is shutting down.' }
      if (this.active > 0) {
        return { ok: false, code: 'busy', message: 'The voice engine is still working. Try again in a moment.' }
      }
      if (this.owned) await this.stopOwned()
      if (await this.isPortBusy()) return { ok: false, code: 'foreign', message: PORT_IN_USE_MESSAGE }
      if (this.hooks.peekClaim && await this.hooks.peekClaim()) {
        return { ok: false, code: 'foreign', message: PORT_IN_USE_MESSAGE }
      }
      if (!this.hooks.canStart()) {
        return { ok: false, code: 'failed', message: 'AI Voice Clip Cloning is not installed. Install the voice engine from Settings.' }
      }
      try {
        await this.ensure()
        this.scheduleIdle()
        return { ok: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The AI engine failed to start.'
        return { ok: false, code: message === PORT_IN_USE_MESSAGE ? 'foreign' : 'failed', message }
      }
    })
  }

  /**
   * Stop an in-flight generation by closing only the worker this app started.
   * Returns `foreign` when the port belongs to something else, without signaling it.
   */
  async cancelOwnedGeneration(): Promise<'stopped' | 'idle' | 'foreign'> {
    this.cancellation += 1
    if (!this.owned) {
      if (this.active === 0 && await this.isPortBusy()) return 'foreign'
      return this.active > 0 ? 'stopped' : 'idle'
    }
    await this.stopOwned()
    return 'stopped'
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.chain.then(operation, operation)
    this.chain = run.then(() => undefined, () => undefined)
    return run
  }

  private async ensure(): Promise<WorkerSession> {
    const mark = this.cancellation
    if (this.owned && this.token) {
      const owned = this.owned
      const token = this.token
      const wasReady = this.ready
      const status = await this.pollReady(
        owned,
        token,
        wasReady ? (this.hooks.reuseMs ?? REUSE_PROBE_MS) : (this.hooks.startupMs ?? DEFAULT_STARTUP_MS),
        false,
      )
      if (this.closed) {
        await this.stopOwned()
        throw new Error('AI Clone is shutting down.')
      }
      if (status === 'ready' && this.owned === owned && this.token) {
        this.ready = true
        return { url: AI_SERVER_URL, token: this.token }
      }
      if (this.owned === owned && wasReady) {
        this.note('lifecycle: the owned AI worker did not respond. It was left running so an in-progress voice is not interrupted.')
        throw new Error('The voice engine is still working. Try again in a moment.')
      }
      if (this.cancellation !== mark) throw new Error(AI_GENERATION_STOPPED)
      if (this.owned === owned && status === 'occupied') {
        this.note('lifecycle: the AI port answered without the worker this app started. Not sending audio there.')
        throw new Error(PORT_IN_USE_MESSAGE)
      }
      if (this.owned === owned) {
        return await this.failOwnedStartup(owned, status === 'timeout')
      }
    }
    if (this.cancellation !== mark) throw new Error(AI_GENERATION_STOPPED)
    if (this.closed) throw new Error('AI Clone is shutting down.')
    if (await this.isPortBusy()) throw new Error(PORT_IN_USE_MESSAGE)
    if (!this.hooks.canStart()) {
      throw new Error('AI Voice Clip Cloning is not installed. Install the voice engine from Settings.')
    }
    if (this.hooks.claim) {
      const claim = await this.hooks.claim()
      if (claim === 'held') {
        this.note('lifecycle: another AI engine is already starting or running. Not starting a second one.')
        throw new Error(PORT_IN_USE_MESSAGE)
      }
      this.claimOwned = true
    }
    if (this.cancellation !== mark) {
      this.releaseClaim()
      throw new Error(AI_GENERATION_STOPPED)
    }
    const token = randomBytes(32).toString('hex')
    this.loadingNotice?.()
    this.readyLineSeen = false
    const generation = ++this.workerGeneration
    let owned: OwnedProcess
    try {
      owned = this.hooks.spawn(token)
    } catch (error) {
      this.releaseClaim()
      throw error
    }
    this.owned = owned
    this.token = token
    this.ready = false
    this.hooks.noteWorkerPid?.(owned.pid)
    void owned.exited.then(() => {
      if (this.workerGeneration !== generation) return
      if (this.owned === owned) {
        this.owned = null
        this.token = null
        this.ready = false
        this.clearIdle()
        this.note('lifecycle: AI worker exited.')
      }
      this.releaseClaim()
    })
    const started = this.now()
    const status = await this.pollReady(
      owned,
      token,
      this.hooks.startupMs ?? DEFAULT_STARTUP_MS,
      this.hooks.waitForReadyLine !== false,
    )
    if (this.closed) {
      await this.stopOwned()
      throw new Error('AI Clone is shutting down.')
    }
    if (status === 'ready' && this.owned === owned && this.token) {
      this.ready = true
      this.note(`lifecycle: AI worker is ready after ${Math.round(this.now() - started)} ms.`)
      return { url: AI_SERVER_URL, token }
    }
    if (this.cancellation !== mark) throw new Error(AI_GENERATION_STOPPED)
    if (status === 'occupied') {
      this.note('lifecycle: the AI port answered without the worker this app started. Not sending audio there.')
      if (this.owned === owned) await this.stopOwned()
      throw new Error(PORT_IN_USE_MESSAGE)
    }
    return await this.failOwnedStartup(owned, status === 'timeout')
  }

  private async failOwnedStartup(owned: OwnedProcess, timedOut: boolean): Promise<never> {
    const logged = this.startupFailureMessage()
    const message = timedOut && !/1455|virtual-memory|free memory|out of memory/i.test(logged)
      ? 'The AI engine took too long to start. Try again.'
      : logged
    this.note(`${this.diagnosticKind(message)}: ${message}`)
    if (this.owned === owned) await this.stopOwned()
    else this.releaseClaim()
    throw new Error(message)
  }

  private async pollReady(
    owned: OwnedProcess,
    token: string,
    deadlineMs: number,
    requireLine: boolean,
  ): Promise<'ready' | 'exited' | 'occupied' | 'timeout'> {
    const started = this.now()
    while (this.now() - started < deadlineMs) {
      if (this.closed || this.owned !== owned) return 'exited'
      if (requireLine && !this.readyLineSeen) {
        const code = await this.waitForExit(owned)
        if (code !== undefined || this.owned !== owned) return 'exited'
        continue
      }
      const probe = await this.hooks.probe(token)
      if (this.owned !== owned) return 'exited'
      if (probe.state === 'ready') return 'ready'
      if (probe.state === 'occupied') return 'occupied'
      const code = await this.waitForExit(owned)
      if (code !== undefined || this.owned !== owned) return 'exited'
    }
    return this.owned === owned ? 'timeout' : 'exited'
  }

  private async waitForExit(owned: OwnedProcess): Promise<number | null | undefined> {
    const code = await Promise.race([
      owned.exited.then((exitCode) => exitCode),
      this.sleep(400).then(() => undefined),
    ])
    if (code !== undefined && this.owned === owned) {
      this.owned = null
      this.token = null
      this.ready = false
    }
    return code
  }

  private scheduleIdle(): void {
    if (this.closed || !this.owned || this.active > 0) return
    if (this.idleTimer) clearTimeout(this.idleTimer)
    const epoch = ++this.idleEpoch
    const idleMs = this.hooks.idleMs ?? DEFAULT_IDLE_MS
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null
      void this.enqueue(async () => {
        if (this.closed || !this.owned || this.active > 0 || this.idleEpoch !== epoch) return
        this.note('lifecycle: No AI requests for the idle period. Stopping the worker to release GPU memory.')
        await this.stopOwned()
      })
    }, idleMs)
  }

  private async stopOwned(): Promise<void> {
    const owned = this.owned
    this.workerGeneration += 1
    this.owned = null
    this.token = null
    this.ready = false
    this.clearIdle()
    if (owned) {
      owned.kill()
      await Promise.race([owned.exited, this.sleep(6000)])
    }
    this.releaseClaim()
  }

  private releaseClaim(): void {
    if (!this.claimOwned) return
    this.claimOwned = false
    this.hooks.releaseClaim?.()
  }

  private isPortBusy(): Promise<boolean> {
    return this.hooks.portBusy ? this.hooks.portBusy() : localPortBusy()
  }

  private clearIdle(): void {
    this.idleEpoch += 1
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
  }

  private startupFailureMessage(): string {
    const text = this.recent.join('\n')
    if (/paging file is too small|os error 1455/i.test(text)) {
      return 'Windows ran out of memory while loading the voice model (error 1455). Close other programs and try again. SlipUpClipz will not change Windows virtual-memory settings.'
    }
    if (/out of memory|cuda error/i.test(text)) {
      return 'The GPU does not have enough free memory for AI Clone. Close other GPU programs and try again.'
    }
    if (/address already in use|10048/i.test(text)) return PORT_IN_USE_MESSAGE
    if (/nvidia|cuda|no gpu|not compiled with cuda/i.test(text)) {
      return 'AI Voice Clip Cloning needs a supported NVIDIA GPU and a current NVIDIA driver. No CUDA toolkit installation is required.'
    }
    if (/no such file|not found|local_files_only|couldn't connect/i.test(text)) {
      return 'The voice model files are not installed on this computer.'
    }
    return 'The AI engine failed to start. Details are in the AI log next to the installed voice engine.'
  }

  private diagnosticKind(message: string): 'memory' | 'model-load' | 'lifecycle' {
    if (/1455|paging file|virtual-memory|out of memory|free memory/i.test(message)) return 'memory'
    if (/took too long|failed to start|port|another program|still working/i.test(message)) return 'lifecycle'
    return 'model-load'
  }

  private note(line: string): void {
    if (line.includes(READY_LINE)) this.readyLineSeen = true
    this.recent.push(line)
    if (this.recent.length > 40) this.recent.shift()
    this.hooks.log?.(line)
  }

  remember(line: string): void {
    this.note(line)
  }

  private now(): number {
    return this.hooks.now ? this.hooks.now() : Date.now()
  }

  private sleep(ms: number): Promise<void> {
    return this.hooks.sleep ? this.hooks.sleep(ms) : new Promise((resolve) => setTimeout(resolve, ms))
  }
}
