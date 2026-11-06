import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import {
  archiveMatchesPin,
  componentDirectory,
  componentIsOutsideProfile,
  customerInstallError,
  diskSpaceMessage,
  downloadUrlAllowed,
  formatDownloadGb,
  formatStorageGb,
  pinIsPublishable,
  readAiComponentPin,
  rejectedDownload,
  storeMayDownloadExecutables,
  voiceCloningStorageDecision,
  voiceEngineInstallPolicy,
  inspectInstalledRuntime,
  type AiComponentPin,
} from './aiComponent.js'
import { installVerifiedArchive } from './aiComponentInstall.js'
import { resolveAiRuntime } from './aiWorkerControl.js'
import {
  PREPARING_DOWNLOAD_STAGE,
  failedDownloadFeedback,
  preparingDownloadFeedback,
  voiceDownloadDecision,
  voiceInstallButton,
} from '../shared/voiceInstallClick.js'
import {
  STORAGE_CHECK_FAILED_MESSAGE,
  VOICE_CLONING_ARCHIVE_BYTES,
  VOICE_CLONING_MIN_FREE_BYTES,
  approximateInstallGb,
  extractionAllowanceBytes,
  voiceCloningStorageNote,
  voiceCloningStorageNoteVisible,
  voiceCloningStorageRequirement,
} from '../shared/voiceInstallStorage.js'

const root = mkdtempSync(path.join(tmpdir(), 'slipup-ai-pin-'))

after(() => {
  rmSync(root, { recursive: true, force: true })
})

const pin: AiComponentPin = {
  id: 'slipupclipz-qwen3-tts-0.6b-base',
  componentVersion: '1',
  model: 'Qwen/Qwen3-TTS-12Hz-0.6B-Base',
  archiveName: 'SlipUpClipz-AI-0.1.6.tar',
  sha256: 'a'.repeat(64),
  bytes: 4,
  url: null,
  minFreeBytes: 100,
}

describe('AI component install policy', () => {
  it('keeps the runtime out of the roaming clip profile', () => {
    const roaming = path.join('C:\\Users\\customer\\AppData\\Roaming', 'slipupclipz')
    const local = componentDirectory(path.join('C:\\Users\\customer\\AppData\\Local'))
    assert.equal(componentIsOutsideProfile(local, roaming), true)
    assert.equal(componentIsOutsideProfile(path.join(roaming, 'ai-runtime'), roaming), false)
  })

  it('does not let a Microsoft Store build download executable code', () => {
    assert.equal(storeMayDownloadExecutables(true), false)
    assert.equal(storeMayDownloadExecutables(false), true)
  })

  it('accepts only an https URL that names this exact archive', () => {
    assert.equal(downloadUrlAllowed(null, pin.archiveName), false)
    assert.equal(downloadUrlAllowed('http://example.com/SlipUpClipz-AI-0.1.6.tar', pin.archiveName), false)
    assert.equal(downloadUrlAllowed('https://example.com/latest.tar', pin.archiveName), false)
    assert.equal(
      downloadUrlAllowed('https://github.com/FISHSTICKSBOI1/SlipUpClipz/releases/download/v0.1.6/SlipUpClipz-AI-0.1.6.tar', pin.archiveName),
      true,
    )
  })

  it('rejects a package whose checksum or size does not match the pin', () => {
    const file = path.join(root, 'bad.tar')
    writeFileSync(file, 'nope')
    assert.equal(archiveMatchesPin(file, pin, 'b'.repeat(64))?.includes('checksum'), true)
    const empty = { ...pin, sha256: '', bytes: 0 }
    assert.equal(pinIsPublishable(empty), false)
    assert.equal(archiveMatchesPin(file, empty, 'a'.repeat(64))?.includes('checksum'), true)
  })

  it('requires enough free disk space before installing', () => {
    assert.equal(diskSpaceMessage(50, 100)?.includes('needs'), true)
    assert.equal(diskSpaceMessage(100, 100), null)
  })

  it('reads a pin file without treating a missing checksum as published', () => {
    const pinPath = path.join(root, 'pin.json')
    writeFileSync(pinPath, JSON.stringify({ ...pin, sha256: '', url: null }))
    const read = readAiComponentPin(pinPath)
    assert.equal(read.url, null)
    assert.equal(pinIsPublishable(read), false)
  })

  it('uses an installed component and does not fall back to a development Python folder', () => {
    const appRoot = path.join(root, 'app')
    const resources = path.join(root, 'resources')
    const component = path.join(root, 'local', 'SlipUpClipz', 'ai-runtime')
    mkdirSync(path.join(appRoot, 'ai', '.venv', 'Scripts'), { recursive: true })
    writeFileSync(path.join(appRoot, 'ai', '.venv', 'Scripts', 'python.exe'), '')
    mkdirSync(path.join(resources, 'ai-app'), { recursive: true })
    writeFileSync(path.join(resources, 'ai-app', 'server.py'), '')
    mkdirSync(path.join(component, 'python'), { recursive: true })
    writeFileSync(path.join(component, 'python', 'python.exe'), '')
    writeFileSync(path.join(component, 'COMPLETE'), 'ok')
    const runtime = resolveAiRuntime(appRoot, {
      packaged: true,
      resourcesPath: resources,
      componentRoot: component,
    })
    assert.equal(runtime.source, 'component')
    assert.equal(runtime.pythonPath.includes(`${path.sep}ai-runtime${path.sep}python${path.sep}python.exe`), true)
    const missing = resolveAiRuntime(appRoot, {
      packaged: true,
      resourcesPath: resources,
      componentRoot: path.join(root, 'none'),
    })
    assert.equal(missing.source, 'missing')
    assert.equal(missing.pythonPath, '')
  })

  it('uses the voice engine shipped inside a Store package when no separate component is installed', () => {
    const appRoot = path.join(root, 'store-app')
    const resources = path.join(root, 'store-resources')
    mkdirSync(path.join(resources, 'ai-app'), { recursive: true })
    writeFileSync(path.join(resources, 'ai-app', 'server.py'), '')
    mkdirSync(path.join(resources, 'ai-runtime', 'python'), { recursive: true })
    mkdirSync(path.join(resources, 'ai-runtime', 'models', 'huggingface', 'hub'), { recursive: true })
    writeFileSync(path.join(resources, 'ai-runtime', 'python', 'python.exe'), '')
    const runtime = resolveAiRuntime(appRoot, {
      packaged: true,
      resourcesPath: resources,
      componentRoot: path.join(root, 'no-component'),
    })
    assert.equal(runtime.source, 'bundled')
    assert.equal(runtime.pythonPath.endsWith(`${path.sep}ai-runtime${path.sep}python${path.sep}python.exe`), true)
    assert.equal(runtime.modelHome.endsWith(`${path.sep}models${path.sep}huggingface`), true)
  })

  it('does not install an executable package into a Microsoft Store build', async () => {
    const result = await installVerifiedArchive({
      archivePath: path.join(root, 'missing.tar'),
      componentDir: path.join(root, 'store-component'),
      pin,
      windowsStore: true,
      freeBytes: pin.minFreeBytes,
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /Microsoft Store/)
  })

  it('labels the 7.7 GB download separately from the 16 GB setup requirement', () => {
    const published = readAiComponentPin(path.join(import.meta.dirname, '..', 'shared', 'aiComponentPin.json'))
    assert.equal(published.bytes, 7707726336)
    assert.equal(published.bytes, VOICE_CLONING_ARCHIVE_BYTES)
    assert.equal(published.minFreeBytes, 16707726336)
    assert.equal(published.minFreeBytes, VOICE_CLONING_MIN_FREE_BYTES)
    assert.equal(published.url, 'https://downloads.slipupclipz.com/SlipUpClipz-AI-0.1.6.tar')
    assert.equal(formatDownloadGb(published.bytes), '7.7 GB')
    assert.equal(formatStorageGb(published.minFreeBytes), '15.6 GB')
    assert.equal(approximateInstallGb(published.minFreeBytes), 16)
    assert.equal(Math.ceil(published.minFreeBytes / 1_000_000_000), 17)
    assert.ok(16 * 1024 * 1024 * 1024 > published.minFreeBytes)
    assert.ok(extractionAllowanceBytes(published.bytes, published.minFreeBytes) >= published.bytes)
    assert.equal(
      published.bytes + extractionAllowanceBytes(published.bytes, published.minFreeBytes),
      published.minFreeBytes,
    )
    assert.equal(
      voiceCloningStorageRequirement(published.minFreeBytes),
      'Requires approximately 16 GB of free storage to install Voice Cloning.',
    )
    assert.equal(voiceCloningStorageNoteVisible('website'), true)
    assert.equal(voiceCloningStorageNoteVisible('microsoft-store'), false)
    assert.match(voiceCloningStorageNote(published.minFreeBytes, 'ready'), /Voice Cloning is installed/)
    assert.match(voiceCloningStorageNote(published.minFreeBytes, 'ready'), /16 GB/)
    assert.match(voiceCloningStorageNote(published.minFreeBytes, 'missing'), /to install Voice Cloning/)
  })

  it('does not offer a packaged file picker, and download requires paid Pro plus a real URL', () => {
    const free = voiceEngineInstallPolicy({
      packaged: true,
      windowsStore: false,
      paidPro: false,
      downloadReady: false,
    })
    assert.deepEqual(free, {
      requiresPro: true,
      canDownload: false,
      canChooseFile: false,
      setupUnavailable: false,
    })

    const proWithoutDownload = voiceEngineInstallPolicy({
      packaged: true,
      windowsStore: false,
      paidPro: true,
      downloadReady: false,
    })
    assert.equal(proWithoutDownload.canDownload, false)
    assert.equal(proWithoutDownload.canChooseFile, false)
    assert.equal(proWithoutDownload.setupUnavailable, true)

    const proWithDownload = voiceEngineInstallPolicy({
      packaged: true,
      windowsStore: false,
      paidPro: true,
      downloadReady: true,
    })
    assert.equal(proWithDownload.canDownload, true)
    assert.equal(proWithDownload.canChooseFile, false)

    const store = voiceEngineInstallPolicy({
      packaged: true,
      windowsStore: true,
      paidPro: true,
      downloadReady: true,
    })
    assert.equal(store.canDownload, false)
    assert.equal(store.canChooseFile, false)

    const developer = voiceEngineInstallPolicy({
      packaged: false,
      windowsStore: false,
      paidPro: false,
      downloadReady: false,
    })
    assert.equal(developer.canChooseFile, true)
    assert.equal(developer.canDownload, false)
  })

  it('shows Preparing download after Free becomes Pro, and shows a click that cannot start', () => {
    const free = voiceEngineInstallPolicy({
      packaged: true,
      windowsStore: false,
      paidPro: false,
      downloadReady: true,
    })
    const before = {
      status: 'missing' as const,
      stage: null,
      error: null,
      progressPercent: null,
      canDownload: free.canDownload,
      requiresPro: free.requiresPro,
    }
    assert.equal(before.canDownload, false)
    assert.equal(before.requiresPro, true)

    const pro = voiceEngineInstallPolicy({
      packaged: true,
      windowsStore: false,
      paidPro: true,
      downloadReady: true,
    })
    const ready = { ...before, canDownload: pro.canDownload, requiresPro: pro.requiresPro }
    assert.equal(ready.canDownload, true)

    const clicked = preparingDownloadFeedback(ready)
    assert.equal(clicked.status, 'installing')
    assert.equal(clicked.stage, PREPARING_DOWNLOAD_STAGE)
    assert.equal(clicked.error, null)

    const blocked = failedDownloadFeedback(
      clicked,
      'Not enough storage. Voice Cloning needs approximately 16 GB of free space to install. You currently have 1.0 GB available.',
    )
    assert.equal(blocked.status, 'failed')
    assert.match(blocked.error ?? '', /approximately 16 GB/)
    assert.equal(customerInstallError(blocked.error ?? ''), blocked.error)
    assert.equal(failedDownloadFeedback(clicked, '').error, 'Installation failed. Try again.')
  })

  it('hides checksum failures from the customer message and keeps the disk-space message', () => {
    assert.equal(
      customerInstallError('The AI component package checksum does not match this version of SlipUpClipz.'),
      'The download could not be verified. Try again.',
    )
    assert.equal(
      rejectedDownload({
        finalUrl: 'https://downloads.example.com/SlipUpClipz-AI-0.1.6.tar',
        announcedBytes: 7707726336,
        expectedBytes: 7707726336,
        receivedBytes: 7707726336,
      }),
      null,
    )
    assert.equal(
      rejectedDownload({
        finalUrl: 'http://downloads.example.com/SlipUpClipz-AI-0.1.6.tar',
        announcedBytes: 7707726336,
        expectedBytes: 7707726336,
      }),
      'The download could not be completed.',
    )
    assert.equal(
      rejectedDownload({
        finalUrl: 'https://downloads.example.com/SlipUpClipz-AI-0.1.6.tar',
        announcedBytes: 100,
        expectedBytes: 7707726336,
      }),
      'The download could not be verified. Try again.',
    )
    assert.equal(
      rejectedDownload({
        finalUrl: 'https://downloads.example.com/SlipUpClipz-AI-0.1.6.tar',
        announcedBytes: 0,
        expectedBytes: 7707726336,
        receivedBytes: 10,
      }),
      'The download stopped before it finished.',
    )
    const space = diskSpaceMessage(1024 * 1024 * 1024, 16707726336)
    assert.match(space ?? '', /approximately 16 GB/)
    assert.match(space ?? '', /1\.0 GB available/)
    assert.equal(customerInstallError(space ?? ''), space)
    assert.equal(customerInstallError(STORAGE_CHECK_FAILED_MESSAGE), STORAGE_CHECK_FAILED_MESSAGE)
  })

  it('checks the Voice Cloning drives and blocks the download when storage is short', () => {
    const published = readAiComponentPin(path.join(import.meta.dirname, '..', 'shared', 'aiComponentPin.json'))
    const componentDir = 'C:\\Users\\me\\AppData\\Local\\SlipUpClipz\\ai-runtime'
    const tempDir = 'C:\\Users\\me\\AppData\\Local\\Temp'
    const gib = 1024 * 1024 * 1024

    const enough = voiceCloningStorageDecision({
      tempDir,
      componentDir,
      archiveBytes: published.bytes,
      minFreeBytes: published.minFreeBytes,
      freeBytes: (dir) => {
        assert.equal(dir.startsWith('E:'), false)
        return published.minFreeBytes
      },
    })
    assert.equal(enough.startDownload, true)
    assert.equal(enough.error, null)

    const oneByteShort = voiceCloningStorageDecision({
      tempDir,
      componentDir,
      archiveBytes: published.bytes,
      minFreeBytes: published.minFreeBytes,
      freeBytes: () => published.minFreeBytes - 1,
    })
    assert.equal(oneByteShort.startDownload, false)
    assert.match(oneByteShort.error ?? '', /approximately 16 GB/)
    assert.equal(customerInstallError(oneByteShort.error ?? ''), oneByteShort.error)

    const lowInstallDrive = voiceCloningStorageDecision({
      tempDir,
      componentDir,
      archiveBytes: published.bytes,
      minFreeBytes: published.minFreeBytes,
      freeBytes: () => gib,
    })
    assert.equal(
      lowInstallDrive.error,
      'Not enough storage. Voice Cloning needs approximately 16 GB of free space to install. You currently have 1.0 GB available.',
    )

    const extractionOnly = extractionAllowanceBytes(published.bytes, published.minFreeBytes)
    const archiveWithoutRoomToExtract = voiceCloningStorageDecision({
      tempDir,
      componentDir,
      archiveBytes: published.bytes,
      minFreeBytes: published.minFreeBytes,
      freeBytes: () => extractionOnly,
    })
    assert.equal(archiveWithoutRoomToExtract.startDownload, false)

    const splitEnough = voiceCloningStorageDecision({
      tempDir: 'D:\\Temp',
      componentDir,
      archiveBytes: published.bytes,
      minFreeBytes: published.minFreeBytes,
      freeBytes: (dir) => (dir.startsWith('D:') ? published.bytes : extractionOnly),
    })
    assert.equal(splitEnough.startDownload, true)

    const lowDownloadDrive = voiceCloningStorageDecision({
      tempDir: 'D:\\Temp',
      componentDir,
      archiveBytes: published.bytes,
      minFreeBytes: published.minFreeBytes,
      freeBytes: (dir) => (dir.startsWith('D:') ? gib : 100 * gib),
    })
    assert.equal(lowDownloadDrive.startDownload, false)
    assert.match(lowDownloadDrive.error ?? '', /approximately 8 GB/)
    assert.doesNotMatch(lowDownloadDrive.error ?? '', /16 GB/)

    const lowRuntimeDrive = voiceCloningStorageDecision({
      tempDir: 'D:\\Temp',
      componentDir,
      archiveBytes: published.bytes,
      minFreeBytes: published.minFreeBytes,
      freeBytes: (dir) => (dir.startsWith('D:') ? published.bytes : gib),
    })
    assert.equal(lowRuntimeDrive.startDownload, false)
    assert.match(lowRuntimeDrive.error ?? '', /approximately 9 GB/)

    const unread = voiceCloningStorageDecision({
      tempDir,
      componentDir,
      archiveBytes: published.bytes,
      minFreeBytes: published.minFreeBytes,
      freeBytes: () => {
        throw new Error('statfs failed')
      },
    })
    assert.equal(unread.startDownload, false)
    assert.equal(unread.error, STORAGE_CHECK_FAILED_MESSAGE)
  })

  it('recognizes a healthy runtime after restart and does not offer another download', () => {
    const runtime = path.join(root, 'installed-runtime')
    mkdirSync(path.join(runtime, 'python'), { recursive: true })
    writeFileSync(path.join(runtime, 'python', 'python.exe'), '')
    mkdirSync(path.join(runtime, 'models', 'whisper-tiny.en'), { recursive: true })
    mkdirSync(path.join(runtime, 'models', 'huggingface', 'hub'), { recursive: true })
    mkdirSync(path.join(runtime, 'NOTICES'), { recursive: true })
    writeFileSync(path.join(runtime, 'NOTICES', 'THIRD-PARTY-NOTICES.txt'), 'notices')
    writeFileSync(path.join(runtime, 'COMPLETE'), 'ok\n')
    writeFileSync(
      path.join(runtime, 'installed.json'),
      JSON.stringify({ id: pin.id, sha256: pin.sha256, componentVersion: pin.componentVersion }),
    )

    const first = inspectInstalledRuntime(runtime, pin)
    const afterRestart = inspectInstalledRuntime(runtime, pin)
    assert.equal(first.state, 'ready')
    assert.equal(afterRestart.state, 'ready')
    assert.equal(voiceInstallButton({ status: 'installed', runtime: 'ready', canDownload: true }), 'none')
    assert.equal(voiceDownloadDecision({ alreadyInstalling: false, runtime: 'ready' }), 'already-installed')
    assert.equal(voiceDownloadDecision({ alreadyInstalling: true, runtime: 'missing' }), 'busy')

    rmSync(path.join(runtime, 'python', 'python.exe'))
    const damaged = inspectInstalledRuntime(runtime, pin)
    assert.equal(damaged.state, 'repair')
    assert.match(damaged.error ?? '', /Repair/)
    assert.equal(voiceInstallButton({ status: 'failed', runtime: 'repair', canDownload: true }), 'repair')

    writeFileSync(path.join(runtime, 'python', 'python.exe'), '')
    writeFileSync(
      path.join(runtime, 'installed.json'),
      JSON.stringify({ id: pin.id, sha256: 'b'.repeat(64), componentVersion: '2' }),
    )
    assert.equal(inspectInstalledRuntime(runtime, pin).state, 'update')
    assert.equal(voiceInstallButton({ status: 'installed', runtime: 'update', canDownload: true }), 'update')
    assert.equal(voiceDownloadDecision({ alreadyInstalling: false, runtime: 'update' }), 'download')

    const empty = path.join(root, 'empty-runtime')
    mkdirSync(empty, { recursive: true })
    assert.equal(inspectInstalledRuntime(empty, pin).state, 'missing')
    assert.equal(voiceInstallButton({ status: 'missing', runtime: 'missing', canDownload: true }), 'install')
    assert.equal(voiceInstallButton({ status: 'failed', runtime: 'missing', canDownload: true }), 'retry')
    assert.equal(voiceInstallButton({ status: 'installing', runtime: 'missing', canDownload: true }), 'none')
  })
})
