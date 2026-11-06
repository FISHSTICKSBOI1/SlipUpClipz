import { app } from 'electron'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatDisplayedVersion } from './appVersionFormat.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readPackageVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }
    return pkg.version?.trim() || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/** Packaged builds use Electron's embedded version. Dev builds read package.json. */
export function getDisplayedAppVersion(): string {
  if (app.isPackaged) return formatDisplayedVersion(app.getVersion(), true)
  return formatDisplayedVersion(readPackageVersion(), false)
}
