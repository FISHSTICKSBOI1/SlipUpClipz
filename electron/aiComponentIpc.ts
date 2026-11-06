import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { createWriteStream, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  bundledRuntimeDirectory,
  componentDirectory,
  componentFilesReady,
  customerInstallError,
  downloadUrlAllowed,
  inspectInstalledRuntime,
  localAppDataDirectory,
  pinIsPublishable,
  readAiComponentPin,
  rejectedDownload,
  voiceCloningStorageDecision,
  voiceEngineInstallPolicy,
  type AiComponentStatus,
  type RuntimeInstallState,
} from './aiComponent.js'
import { freeBytesAt, installVerifiedArchive } from './aiComponentInstall.js'
import { PREPARING_DOWNLOAD_STAGE, voiceDownloadDecision } from '../shared/voiceInstallClick.js'
import { currentLicenseSnapshot, revalidateStoredLicenseBeforeDownload } from './license.js'

const STORE_MESSAGE =
  'This Microsoft Store installation includes Voice Cloning only when the voice engine is in the package. It does not download it separately.'

const UNAVAILABLE_MESSAGE = 'Voice Cloning setup is temporarily unavailable.'

const PRO_MESSAGE = 'AI Voice Clip Cloning requires Pro.'

type ComponentView = {
  status: AiComponentStatus
  distribution: 'website' | 'microsoft-store'
  progressPercent: number | null
  stage: string | null
  error: string | null
  canDownload: boolean
  canChooseFile: boolean
  requiresPro: boolean
  setupUnavailable: boolean
  updateAvailable: boolean
  runtime: RuntimeInstallState
  downloadBytes: number
  requiredFreeBytes: number
}

let view: ComponentView = {
  status: 'missing',
  distribution: 'website',
  progressPercent: null,
  stage: null,
  error: null,
  canDownload: false,
  canChooseFile: false,
  requiresPro: true,
  setupUnavailable: false,
  updateAvailable: false,
  runtime: 'missing',
  downloadBytes: 0,
  requiredFreeBytes: 0,
}

let activeInstall: AbortController | null = null

function pinFile(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'ai-component-pin.json')
  return path.join(process.env.APP_ROOT || path.join(import.meta.dirname, '..'), 'shared', 'aiComponentPin.json')
}

function paidPro(): boolean {
  const snapshot = currentLicenseSnapshot()
  return snapshot.access === 'license' && snapshot.isPro
}

function publish(getWindow: () => BrowserWindow | null, next: Partial<ComponentView>): ComponentView {
  view = { ...view, ...next }
  const window = getWindow()
  if (window && !window.isDestroyed()) window.webContents.send('ai-component:state', view)
  return view
}

function refresh(getWindow: () => BrowserWindow | null): ComponentView {
  const store = process.windowsStore === true
  const pin = readAiComponentPin(pinFile())
  const dir = componentDirectory(localAppDataDirectory(app.getPath('appData')))
  const bundled = app.isPackaged && componentFilesReady(bundledRuntimeDirectory(process.resourcesPath))
  const inspected = inspectInstalledRuntime(dir, pin)
  const runtime: RuntimeInstallState = bundled ? 'ready' : inspected.state
  const installed = runtime === 'ready' || runtime === 'update'
  const downloadReady = pinIsPublishable(pin) && downloadUrlAllowed(pin.url, pin.archiveName)
  const policy = voiceEngineInstallPolicy({
    packaged: app.isPackaged,
    windowsStore: store,
    paidPro: paidPro(),
    downloadReady,
  })
  const installing = view.status === 'installing'
  const status: AiComponentStatus = installing
    ? 'installing'
    : runtime === 'repair'
      ? 'failed'
      : installed
        ? 'installed'
        : view.status === 'failed'
          ? 'failed'
          : 'missing'
  const error = installing
    ? view.error
    : runtime === 'repair'
      ? inspected.error
      : installed
        ? null
        : view.error
  return publish(getWindow, {
    status,
    distribution: store ? 'microsoft-store' : 'website',
    error,
    stage: installing ? view.stage : null,
    canDownload: policy.canDownload && runtime !== 'ready',
    canChooseFile: policy.canChooseFile && currentLicenseSnapshot().access !== 'free',
    requiresPro: policy.requiresPro,
    setupUnavailable: policy.setupUnavailable,
    updateAvailable: runtime === 'update',
    runtime,
    downloadBytes: pin.bytes,
    requiredFreeBytes: pin.minFreeBytes,
    progressPercent: installing ? view.progressPercent : null,
  })
}

function stopCanceled(getWindow: () => BrowserWindow | null): { ok: false; error: string } {
  view = { ...view, status: 'missing', error: null, stage: null, progressPercent: null }
  const next = refresh(getWindow)
  if (next.status !== 'installed') {
    publish(getWindow, { status: 'missing', error: 'Installation canceled.', stage: null, progressPercent: null })
  }
  return { ok: false, error: 'Installation canceled.' }
}

async function installFromFile(
  archivePath: string,
  getWindow: () => BrowserWindow | null,
  signal: AbortSignal,
  afterDownload: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const pin = readAiComponentPin(pinFile())
  let lastError = 'Voice Cloning could not be installed.'
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (signal.aborted) return stopCanceled(getWindow)
    const result = await installVerifiedArchive({
      archivePath,
      componentDir: componentDirectory(localAppDataDirectory(app.getPath('appData'))),
      pin,
      windowsStore: process.windowsStore === true,
      signal,
      onProgress: (progress) => {
        const scaled = afterDownload ? 70 + Math.round(progress.percent * 0.3) : progress.percent
        publish(getWindow, {
          status: 'installing',
          progressPercent: scaled,
          stage: attempt > 1 ? `${progress.stage} (try ${attempt} of 3)` : progress.stage,
          error: null,
        })
      },
    })
    if (result.ok) {
      publish(getWindow, { status: 'installed', progressPercent: 100, stage: null, error: null })
      refresh(getWindow)
      return { ok: true }
    }
    lastError = result.error
    if (/cancel/i.test(lastError) || signal.aborted) return stopCanceled(getWindow)
    if (/checksum|wrong size|not enough storage|could not check free storage|free before it can be installed/i.test(lastError)) break
  }
  console.error('[ai-component]', lastError)
  const message = customerInstallError(lastError)
  publish(getWindow, { status: 'failed', error: message, stage: null, progressPercent: null })
  return { ok: false, error: message }
}

async function requirePaidPro(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await revalidateStoredLicenseBeforeDownload()
  } catch (error) {
    console.error('[ai-component] license revalidation failed', error)
  }
  if (!paidPro()) return { ok: false, error: PRO_MESSAGE }
  return { ok: true }
}

export function registerAiComponentIpc(getWindow: () => BrowserWindow | null): void {
  refresh(getWindow)

  ipcMain.handle('ai-component:getState', () => refresh(getWindow))

  ipcMain.handle('ai-component:cancel', () => {
    activeInstall?.abort()
    if (view.status === 'installing') return stopCanceled(getWindow)
    return { ok: true }
  })

  ipcMain.handle('ai-component:choose-file', async () => {
    if (app.isPackaged || process.windowsStore === true) {
      return { ok: false, error: process.windowsStore === true ? STORE_MESSAGE : UNAVAILABLE_MESSAGE }
    }
    if (currentLicenseSnapshot().access === 'free') {
      return { ok: false, error: PRO_MESSAGE }
    }
    const window = getWindow()
    const picked = window
      ? await dialog.showOpenDialog(window, {
          title: 'Choose a local Voice Cloning package',
          filters: [{ name: 'Package', extensions: ['tar'] }],
          properties: ['openFile'],
        })
      : await dialog.showOpenDialog({
          title: 'Choose a local Voice Cloning package',
          filters: [{ name: 'Package', extensions: ['tar'] }],
          properties: ['openFile'],
        })
    if (picked.canceled || !picked.filePaths[0]) return { ok: false, error: 'Installation canceled.' }
    const entitlement = await requirePaidPro()
    if (!entitlement.ok && currentLicenseSnapshot().access !== 'development') return entitlement
    activeInstall?.abort()
    activeInstall = new AbortController()
    try {
      return await installFromFile(picked.filePaths[0], getWindow, activeInstall.signal, false)
    } finally {
      activeInstall = null
    }
  })

  ipcMain.handle('ai-component:download', async () => {
    if (view.status === 'installing') return { ok: true }
    const fail = (error: string) => {
      const failed = { status: 'failed' as const, error, stage: null, progressPercent: null }
      publish(getWindow, failed)
      try {
        refresh(getWindow)
      } catch (refreshError) {
        console.error('[ai-component]', refreshError)
      }
      if (view.status !== 'failed' || view.error !== error) publish(getWindow, failed)
      return { ok: false as const, error }
    }
    let pin: ReturnType<typeof readAiComponentPin>
    let componentDir: string
    try {
      pin = readAiComponentPin(pinFile())
      componentDir = componentDirectory(localAppDataDirectory(app.getPath('appData')))
      const decision = voiceDownloadDecision({
        alreadyInstalling: false,
        runtime: inspectInstalledRuntime(componentDir, pin).state,
      })
      if (decision === 'already-installed') {
        refresh(getWindow)
        return { ok: true }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[ai-component]', detail)
      return fail(customerInstallError(detail))
    }
    publish(getWindow, {
      status: 'installing',
      progressPercent: 0,
      stage: PREPARING_DOWNLOAD_STAGE,
      error: null,
    })
    try {
      if (process.windowsStore === true) return fail(STORE_MESSAGE)
      const entitlement = await requirePaidPro()
      if (!entitlement.ok) return fail(entitlement.error)
      if (!downloadUrlAllowed(pin.url, pin.archiveName) || !pin.url) {
        return fail(UNAVAILABLE_MESSAGE)
      }
      const destination = path.join(app.getPath('temp'), pin.archiveName)
      const storage = voiceCloningStorageDecision({
        tempDir: path.dirname(destination),
        componentDir,
        archiveBytes: pin.bytes,
        minFreeBytes: pin.minFreeBytes,
        freeBytes: freeBytesAt,
      })
      if (!storage.startDownload) return fail(storage.error ?? 'Could not check free storage for Voice Cloning. Confirm the drive where it installs is available, then try again.')
      activeInstall?.abort()
      activeInstall = new AbortController()
      const signal = activeInstall.signal
      publish(getWindow, { status: 'installing', progressPercent: 0, stage: 'Downloading Voice Cloning', error: null })
      try {
        try {
          await downloadArchive(pin.url, destination, pin.bytes, signal, (percent) => {
            publish(getWindow, {
              status: 'installing',
              progressPercent: Math.round(percent * 0.7),
              stage: 'Downloading Voice Cloning',
            })
          })
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error)
          if (/cancel/i.test(detail) || signal.aborted) return stopCanceled(getWindow)
          console.error('[ai-component]', detail)
          const message = customerInstallError(detail)
          publish(getWindow, { status: 'failed', error: message, stage: null, progressPercent: null })
          return { ok: false, error: message }
        }
        if (signal.aborted) return stopCanceled(getWindow)
        return await installFromFile(destination, getWindow, signal, true)
      } finally {
        rmSync(destination, { force: true })
        rmSync(`${destination}.partial`, { force: true })
        if (activeInstall?.signal === signal) activeInstall = null
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[ai-component]', detail)
      return fail(customerInstallError(detail))
    }
  })
}

async function downloadArchive(
  url: string,
  destination: string,
  expectedBytes: number,
  signal: AbortSignal,
  onPercent: (percent: number) => void,
): Promise<void> {
  mkdirSync(path.dirname(destination), { recursive: true })
  const partial = `${destination}.partial`
  rmSync(partial, { force: true })
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (signal.aborted) throw new Error('Installation canceled.')
    try {
      const response = await fetch(url, { signal, redirect: 'follow' })
      if (!response.ok || !response.body) throw new Error('The download could not be completed.')
      const announced = Number(response.headers.get('content-length') || 0)
      const early = rejectedDownload({
        finalUrl: response.url || url,
        announcedBytes: announced,
        expectedBytes,
      })
      if (early) throw new Error(early)
      let received = 0
      const reader = response.body.getReader()
      const stream = createWriteStream(partial)
      try {
        while (true) {
          const { done, value } = await readDownloadChunk(reader, signal)
          if (done) break
          if (!value) continue
          received += value.byteLength
          if (expectedBytes > 0) onPercent(Math.min(100, Math.round((received / expectedBytes) * 100)))
          if (!stream.write(Buffer.from(value))) {
            await new Promise<void>((resolve) => {
              stream.once('drain', () => resolve())
            })
          }
        }
        await new Promise<void>((resolve, reject) => {
          stream.once('error', reject)
          stream.once('finish', () => resolve())
          stream.end()
        })
      } catch (error) {
        stream.destroy()
        throw error
      }
      const receivedBytes = statSync(partial).size
      const finished = rejectedDownload({
        finalUrl: response.url || url,
        announcedBytes: announced,
        expectedBytes,
        receivedBytes,
      })
      if (finished) throw new Error(finished)
      rmSync(destination, { force: true })
      renameSync(partial, destination)
      return
    } catch (error) {
      lastError = error
      rmSync(partial, { force: true })
      if (signal.aborted || (error instanceof Error && /cancel/i.test(error.message))) {
        throw new Error('Installation canceled.')
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The download could not be completed.')
}

const DOWNLOAD_STALL_MS = 120_000

function readDownloadChunk(
  reader: { read: () => Promise<{ done: boolean; value?: Uint8Array }>; cancel: () => Promise<void> },
  signal: AbortSignal,
): Promise<{ done: boolean; value?: Uint8Array }> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Installation canceled.'))
      return
    }
    const timer = setTimeout(() => {
      reader.cancel().catch(() => undefined)
      reject(new Error('The download stopped before it finished.'))
    }, DOWNLOAD_STALL_MS)
    const onAbort = () => {
      clearTimeout(timer)
      reader.cancel().catch(() => undefined)
      reject(new Error('Installation canceled.'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    reader.read().then(
      (result) => {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        resolve(result)
      },
      (error) => {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}
