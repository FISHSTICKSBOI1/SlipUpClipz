import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  STORAGE_CHECK_FAILED_MESSAGE,
  extractionAllowanceBytes,
  insufficientVoiceCloningStorage,
} from '../shared/voiceInstallStorage.js'

export const AI_COMPONENT_DIR_NAME = 'ai-runtime'
export const AI_ARCHIVE_NAME = 'SlipUpClipz-AI-0.1.6.tar'

export type AiComponentPin = {
  id: string
  componentVersion: string
  model: string
  archiveName: string
  sha256: string
  bytes: number
  url: string | null
  minFreeBytes: number
}

export type AiComponentStatus = 'missing' | 'installing' | 'installed' | 'failed'

export function readAiComponentPin(filePath: string): AiComponentPin {
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<AiComponentPin>
  return {
    id: String(raw.id || ''),
    componentVersion: String(raw.componentVersion || ''),
    model: String(raw.model || ''),
    archiveName: String(raw.archiveName || AI_ARCHIVE_NAME),
    sha256: String(raw.sha256 || '').toLowerCase(),
    bytes: Number(raw.bytes || 0),
    url: typeof raw.url === 'string' && raw.url.trim() ? raw.url.trim() : null,
    minFreeBytes: Number(raw.minFreeBytes || 0),
  }
}

export function pinIsPublishable(pin: AiComponentPin): boolean {
  return /^[a-f0-9]{64}$/.test(pin.sha256) && pin.bytes > 0 && pin.model === 'Qwen/Qwen3-TTS-12Hz-0.6B-Base'
}

/** Local app data beside Roaming, including the MSIX virtualized LocalCache\Local folder. */
export function localAppDataDirectory(roamingAppData: string): string {
  return path.resolve(roamingAppData, '..', 'Local')
}

/** Local app data, not the roaming clip profile. MSIX virtualizes this per package. */
export function componentDirectory(localAppData: string): string {
  return path.join(localAppData, 'SlipUpClipz', AI_COMPONENT_DIR_NAME)
}

/** Voice engine shipped inside a Store package. This is not a downloaded installer. */
export function bundledRuntimeDirectory(resourcesPath: string): string {
  return path.join(resourcesPath, 'ai-runtime')
}

export function componentIsOutsideProfile(componentDir: string, userDataDir: string): boolean {
  const component = path.resolve(componentDir)
  const profile = path.resolve(userDataDir)
  return component !== profile && !component.startsWith(profile + path.sep)
}

/** Store policy 10.2.2: do not download executable code into an MSIX app. */
export function storeMayDownloadExecutables(windowsStore: boolean): boolean {
  return windowsStore !== true
}

export function downloadUrlAllowed(url: string | null, archiveName: string): boolean {
  if (!url || !archiveName) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.pathname.endsWith(`/${archiveName}`)
  } catch {
    return false
  }
}

/** Decimal GB, matching the approximate 7.7 GB download size of the verified archive. */
export function formatDownloadGb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 GB'
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`
}

/** Windows-style GB (1024³). minFreeBytes is the free-space check, about 15.6 GB. */
export function formatStorageGb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 GB'
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export function rejectedDownload(input: {
  finalUrl: string
  announcedBytes: number
  expectedBytes: number
  receivedBytes?: number
}): string | null {
  let protocol = ''
  try {
    protocol = new URL(input.finalUrl).protocol
  } catch {
    return 'The download could not be completed.'
  }
  if (protocol !== 'https:') return 'The download could not be completed.'
  if (input.announcedBytes > 0 && input.announcedBytes !== input.expectedBytes) {
    return 'The download could not be verified. Try again.'
  }
  if (input.receivedBytes != null && input.receivedBytes !== input.expectedBytes) {
    return 'The download stopped before it finished.'
  }
  return null
}

export function diskSpaceMessage(freeBytes: number, requiredBytes: number): string | null {
  if (requiredBytes <= 0 || freeBytes >= requiredBytes) return null
  return insufficientVoiceCloningStorage(freeBytes, requiredBytes)
}

export type VoiceCloningStorageDecision = {
  startDownload: boolean
  error: string | null
}

/**
 * Check only the temp archive drive and the Voice Cloning runtime drive.
 * On one drive the archive and the extracted copy both have to fit.
 * After the archive is already on disk, only the extraction allowance is still required.
 */
export function voiceCloningStorageDecision(input: {
  tempDir: string
  componentDir: string
  archiveBytes: number
  minFreeBytes: number
  freeBytes: (dir: string) => number
}): VoiceCloningStorageDecision {
  try {
    const tempRoot = path.win32.parse(input.tempDir).root.toLowerCase()
    const componentRoot = path.win32.parse(input.componentDir).root.toLowerCase()
    if (!tempRoot || !componentRoot) return { startDownload: false, error: STORAGE_CHECK_FAILED_MESSAGE }
    const extraction = extractionAllowanceBytes(input.archiveBytes, input.minFreeBytes)
    const readFree = (dir: string) => {
      const free = input.freeBytes(dir)
      if (!Number.isFinite(free) || free < 0) throw new Error('Free space could not be read.')
      return free
    }
    if (tempRoot === componentRoot) {
      const required = input.archiveBytes + extraction
      const free = readFree(input.componentDir)
      if (free >= required) return { startDownload: true, error: null }
      return { startDownload: false, error: insufficientVoiceCloningStorage(free, required) }
    }
    const tempFree = readFree(input.tempDir)
    if (tempFree < input.archiveBytes) {
      return { startDownload: false, error: insufficientVoiceCloningStorage(tempFree, input.archiveBytes) }
    }
    const componentFree = readFree(input.componentDir)
    if (componentFree < extraction) {
      return { startDownload: false, error: insufficientVoiceCloningStorage(componentFree, extraction) }
    }
    return { startDownload: true, error: null }
  } catch (error) {
    console.error('[ai-component] storage check failed', error)
    return { startDownload: false, error: STORAGE_CHECK_FAILED_MESSAGE }
  }
}

export function voiceEngineInstallPolicy(input: {
  packaged: boolean
  windowsStore: boolean
  paidPro: boolean
  downloadReady: boolean
}): {
  requiresPro: boolean
  canDownload: boolean
  canChooseFile: boolean
  setupUnavailable: boolean
} {
  return {
    requiresPro: !input.paidPro,
    canDownload: !input.windowsStore && input.paidPro && input.downloadReady,
    canChooseFile: !input.packaged && !input.windowsStore,
    setupUnavailable: !input.windowsStore && input.paidPro && !input.downloadReady,
  }
}

/** Customer text. Disk-space and Store messages stay specific. Checksums stay in the log. */
export function customerInstallError(detail: string): string {
  if (/cancel/i.test(detail)) return 'Installation canceled.'
  if (/not enough storage|could not check free storage|free before it can be installed/i.test(detail)) return detail
  if (/Microsoft Store/i.test(detail)) return detail
  if (/requires Pro/i.test(detail)) return detail
  if (/temporarily unavailable/i.test(detail)) return detail
  if (/checksum|wrong size|could not be verified/i.test(detail)) {
    return 'The download could not be verified. Try again.'
  }
  if (/stopped before it finished/i.test(detail)) return 'The download stopped before it finished. Try again.'
  return 'Installation failed. Try again.'
}

export function hashFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export function archiveMatchesPin(filePath: string, pin: AiComponentPin, sha256: string): string | null {
  if (!pinIsPublishable(pin)) return 'This build does not include a published AI component checksum yet.'
  if (!existsSync(filePath)) return 'The AI component package was not found.'
  const size = statSync(filePath).size
  if (size !== pin.bytes) return 'The AI component package is the wrong size, so it was not installed.'
  if (sha256.toLowerCase() !== pin.sha256) return 'The AI component package checksum does not match this version of SlipUpClipz.'
  return null
}

export function componentFilesReady(componentDir: string): boolean {
  return (
    existsSync(path.join(componentDir, 'python', 'python.exe')) &&
    existsSync(path.join(componentDir, 'models', 'whisper-tiny.en')) &&
    existsSync(path.join(componentDir, 'models', 'huggingface', 'hub')) &&
    existsSync(path.join(componentDir, 'NOTICES', 'THIRD-PARTY-NOTICES.txt'))
  )
}

export function installedComponentReady(componentDir: string, pin: AiComponentPin): boolean {
  return inspectInstalledRuntime(componentDir, pin).state === 'ready'
}

export const RUNTIME_REPAIR_MESSAGE =
  'Voice Cloning files are incomplete. Repair downloads the voice engine again. Clips and settings stay on this PC.'

export type RuntimeInstallState = 'missing' | 'ready' | 'update' | 'repair'

/**
 * Read the runtime directory itself. Ready means the verified file set and install
 * record match this build. A different checksum is an update. A partial directory is repair.
 */
export function inspectInstalledRuntime(
  componentDir: string,
  pin: AiComponentPin,
): { state: RuntimeInstallState; error: string | null } {
  const python = existsSync(path.join(componentDir, 'python', 'python.exe'))
  const whisper = existsSync(path.join(componentDir, 'models', 'whisper-tiny.en'))
  const hub = existsSync(path.join(componentDir, 'models', 'huggingface', 'hub'))
  const notices = existsSync(path.join(componentDir, 'NOTICES', 'THIRD-PARTY-NOTICES.txt'))
  const complete = existsSync(path.join(componentDir, 'COMPLETE'))
  const manifestPath = path.join(componentDir, 'installed.json')
  const manifestExists = existsSync(manifestPath)
  if (!python && !whisper && !hub && !notices && !complete && !manifestExists) {
    return { state: 'missing', error: null }
  }
  if (!python || !whisper || !hub || !notices || !complete || !manifestExists) {
    return { state: 'repair', error: RUNTIME_REPAIR_MESSAGE }
  }
  try {
    const installed = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      id?: string
      sha256?: string
    }
    const sha = String(installed.sha256 || '').toLowerCase()
    if (installed.id !== pin.id || !/^[a-f0-9]{64}$/.test(sha)) {
      return { state: 'repair', error: RUNTIME_REPAIR_MESSAGE }
    }
    if (sha !== pin.sha256.toLowerCase()) return { state: 'update', error: null }
    return { state: 'ready', error: null }
  } catch {
    return { state: 'repair', error: RUNTIME_REPAIR_MESSAGE }
  }
}
