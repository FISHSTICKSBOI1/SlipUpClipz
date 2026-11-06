import { spawn } from 'node:child_process'
import { mkdirSync, renameSync, rmSync, statfsSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import {
  archiveMatchesPin,
  componentFilesReady,
  hashFileSha256,
  diskSpaceMessage,
  storeMayDownloadExecutables,
  type AiComponentPin,
} from './aiComponent.js'
import { extractionAllowanceBytes } from '../shared/voiceInstallStorage.js'

export type InstallProgress = {
  percent: number
  stage: string
}

export async function installVerifiedArchive(options: {
  archivePath: string
  componentDir: string
  pin: AiComponentPin
  windowsStore: boolean
  freeBytes?: number
  signal?: AbortSignal
  onProgress?: (progress: InstallProgress) => void
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!storeMayDownloadExecutables(options.windowsStore)) {
    return {
      ok: false,
      error:
        'This Microsoft Store installation does not download executable files. AI Voice Clip Cloning is included only when this package contains the voice engine.',
    }
  }

  const report = (percent: number, stage: string) => options.onProgress?.({ percent, stage })
  if (options.signal?.aborted) return { ok: false, error: 'Installation canceled.' }
  report(5, 'Checking storage')
  const free = options.freeBytes ?? freeBytes(path.dirname(options.componentDir))
  const extraction = extractionAllowanceBytes(options.pin.bytes, options.pin.minFreeBytes)
  const space = diskSpaceMessage(free, extraction)
  if (space) return { ok: false, error: space }

  if (options.signal?.aborted) return { ok: false, error: 'Installation canceled.' }
  report(15, 'Checking the download')
  let sha256 = ''
  try {
    sha256 = await hashFileSha256(options.archivePath)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  const mismatch = archiveMatchesPin(options.archivePath, options.pin, sha256)
  if (mismatch) return { ok: false, error: mismatch }

  const incoming = `${options.componentDir}.incoming`
  const previous = `${options.componentDir}.previous`
  rmSync(incoming, { recursive: true, force: true })
  if (options.signal?.aborted) return { ok: false, error: 'Installation canceled.' }
  mkdirSync(incoming, { recursive: true })
  report(35, 'Installing Voice Cloning. This can take several minutes.')
  try {
    await extractTar(options.archivePath, incoming, options.signal)
    if (!componentFilesReady(incoming)) {
      throw new Error('The download did not contain the voice engine.')
    }
    writeFileSync(
      path.join(incoming, 'installed.json'),
      JSON.stringify(
        {
          id: options.pin.id,
          componentVersion: options.pin.componentVersion,
          model: options.pin.model,
          sha256: options.pin.sha256,
          archiveName: options.pin.archiveName,
        },
        null,
        2,
      ),
    )
    writeFileSync(path.join(incoming, 'COMPLETE'), 'ok\n')
    rmSync(previous, { recursive: true, force: true })
    if (existsDir(options.componentDir)) renameSync(options.componentDir, previous)
    renameSync(incoming, options.componentDir)
    rmSync(previous, { recursive: true, force: true })
    report(100, 'Ready to use')
    return { ok: true }
  } catch (error) {
    rmSync(incoming, { recursive: true, force: true })
    if (!existsDir(options.componentDir) && existsDir(previous)) {
      try {
        renameSync(previous, options.componentDir)
      } catch {
        // The previous component is still in the .previous folder.
      }
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function existsDir(dir: string): boolean {
  return existsSync(dir)
}

export function freeBytesAt(dir: string): number {
  mkdirSync(dir, { recursive: true })
  const stats = statfsSync(dir)
  return Number(stats.bavail) * Number(stats.bsize)
}

function freeBytes(dir: string): number {
  return freeBytesAt(dir)
}

function extractTar(archivePath: string, destination: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Installation canceled.'))
      return
    }
    const child = spawn('tar', ['-xf', archivePath, '-C', destination], { windowsHide: true })
    const stop = () => {
      child.kill()
    }
    signal?.addEventListener('abort', stop, { once: true })
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      signal?.removeEventListener('abort', stop)
      reject(error)
    })
    child.on('exit', (code) => {
      signal?.removeEventListener('abort', stop)
      if (signal?.aborted) reject(new Error('Installation canceled.'))
      else if (code === 0) resolve()
      else reject(new Error(stderr.trim() || 'Voice Cloning could not be installed.'))
    })
  })
}
