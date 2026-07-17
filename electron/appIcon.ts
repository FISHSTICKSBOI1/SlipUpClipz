import { app, nativeImage, type NativeImage } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Project root when running from dist-electron/ (dev or packaged asar sibling). */
function projectRoot(): string {
  return path.join(__dirname, '..')
}

function firstExisting(...candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return null
}

/** Windows .exe / window / installer icon (multi-size ICO). */
export function getWindowsIconPath(): string | undefined {
  const resolved = firstExisting(
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(projectRoot(), 'build', 'icon.ico'),
    path.join(app.getAppPath(), 'build', 'icon.ico'),
  )
  return resolved ?? undefined
}

function trayPngCandidates(size: 16 | 32): string[] {
  const name = size === 16 ? 'icon-16.png' : 'icon-32.png'
  return [
    path.join(process.resourcesPath, name),
    path.join(process.resourcesPath, 'tray-icon.png'),
    path.join(projectRoot(), 'build', name),
    path.join(projectRoot(), 'build', 'tray-icon.png'),
  ]
}

/**
 * Official SlipUpClipz “S” logo sized for the Windows notification area.
 * Prefer a dedicated tray PNG; fall back to resizing the app ICO.
 */
export function getTrayIconImage(): NativeImage {
  const path16 = firstExisting(...trayPngCandidates(16))
  const path32 = firstExisting(...trayPngCandidates(32))

  if (path16 && path32 && path16 !== path32) {
    const base = nativeImage.createFromPath(path16)
    const hiDpi = nativeImage.createFromPath(path32)
    if (!base.isEmpty() && !hiDpi.isEmpty()) {
      base.addRepresentation({
        scaleFactor: 2,
        width: 32,
        height: 32,
        buffer: hiDpi.toPNG(),
      })
      return base
    }
  }

  const single =
    firstExisting(
      path.join(process.resourcesPath, 'tray-icon.png'),
      path.join(projectRoot(), 'build', 'tray-icon.png'),
      path32 ?? '',
      path16 ?? '',
    ) ?? getWindowsIconPath()

  if (!single) {
    return nativeImage.createEmpty()
  }

  let image = nativeImage.createFromPath(single)
  if (image.isEmpty()) {
    return nativeImage.createEmpty()
  }

  const { width, height } = image.getSize()
  if (width > 32 || height > 32) {
    image = image.resize({ width: 16, height: 16, quality: 'best' })
  }

  return image
}
