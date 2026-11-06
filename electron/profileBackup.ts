import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

/** Folder name under %APPDATA%. v0.1.5 and v0.1.6 both use the package name. */
export const PROFILE_DIR_NAME = 'slipupclipz'
export const PROFILE_STORE_FILE = 'slipupclipz.json'

/** Chromium locations that hold clip metadata and recorded audio. */
export const PROFILE_DATA_DIRECTORIES = ['Local Storage', 'IndexedDB'] as const

const SNAPSHOT_NAME = 'pre-upgrade'
const COMPLETE_MARKER = 'COMPLETE'

export function legacyUserDataPath(appDataDir: string): string {
  return path.join(appDataDir, PROFILE_DIR_NAME)
}

export type ProfileBackupResult =
  | { ok: true; skipped: boolean; backupPath?: string }
  | { ok: false; error: string }

/**
 * Copy the existing settings file before the new version opens it.
 * The original file is not modified. Running this twice keeps one copy per content hash.
 */
export function backupProfileStore(userDataDir: string): ProfileBackupResult {
  const source = path.join(userDataDir, PROFILE_STORE_FILE)
  if (!existsSync(source)) {
    return { ok: true, skipped: true }
  }

  let bytes: Buffer
  try {
    bytes = readFileSync(source)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
  const backupDir = path.join(userDataDir, 'migration-backups')
  const backupPath = path.join(backupDir, `slipupclipz-${hash}.json`)

  try {
    if (existsSync(backupPath)) {
      return { ok: true, skipped: true, backupPath }
    }
    mkdirSync(backupDir, { recursive: true })
    const temporary = path.join(backupDir, `.slipupclipz-${hash}.json.tmp`)
    writeFileSync(temporary, bytes)
    renameSync(temporary, backupPath)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  try {
    const after = readFileSync(source)
    if (!after.equals(bytes)) {
      return { ok: false, error: 'Profile changed while the backup was written' }
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  return { ok: true, skipped: false, backupPath }
}

function snapshotDirectory(userDataDir: string): string {
  return path.join(userDataDir, 'migration-backups', SNAPSHOT_NAME)
}

function profileHasData(userDataDir: string): boolean {
  if (existsSync(path.join(userDataDir, PROFILE_STORE_FILE))) return true
  return PROFILE_DATA_DIRECTORIES.some((name) => existsSync(path.join(userDataDir, name)))
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const found: string[] = []
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) found.push(full)
    }
  }
  walk(root)
  return found
}

/**
 * One snapshot of settings, localStorage, and IndexedDB, taken before Chromium opens them.
 * Originals are never deleted. The manifest stores hashes, not the license key.
 */
export function snapshotCompleteProfile(userDataDir: string): ProfileBackupResult {
  const finalDir = snapshotDirectory(userDataDir)
  if (existsSync(path.join(finalDir, COMPLETE_MARKER))) {
    return { ok: true, skipped: true, backupPath: finalDir }
  }
  if (!profileHasData(userDataDir)) {
    return { ok: true, skipped: true }
  }

  const partial = `${finalDir}.partial`
  try {
    rmSync(partial, { recursive: true, force: true })
    mkdirSync(partial, { recursive: true })

    const storeFile = path.join(userDataDir, PROFILE_STORE_FILE)
    if (existsSync(storeFile)) {
      cpSync(storeFile, path.join(partial, PROFILE_STORE_FILE))
    }
    for (const name of PROFILE_DATA_DIRECTORIES) {
      const source = path.join(userDataDir, name)
      if (existsSync(source)) cpSync(source, path.join(partial, name), { recursive: true })
    }

    const entries = listFiles(partial)
      .filter((file) => path.basename(file) !== 'manifest.json')
      .map((file) => {
        const bytes = readFileSync(file)
        return {
          path: path.relative(partial, file).replaceAll('\\', '/'),
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        }
      })
    writeFileSync(
      path.join(partial, 'manifest.json'),
      JSON.stringify({ kind: 'slipupclipz-pre-upgrade', entries }, null, 2),
    )
    writeFileSync(path.join(partial, COMPLETE_MARKER), 'ok\n')

    if (existsSync(storeFile) && !readFileSync(path.join(partial, PROFILE_STORE_FILE)).equals(readFileSync(storeFile))) {
      throw new Error('Profile changed while the snapshot was written')
    }

    rmSync(finalDir, { recursive: true, force: true })
    renameSync(partial, finalDir)
    return { ok: true, skipped: false, backupPath: finalDir }
  } catch (error) {
    rmSync(partial, { recursive: true, force: true })
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Put a completed snapshot back. Call this only while SlipUpClipz is closed.
 * The current profile is copied aside first. The snapshot itself is not deleted.
 */
export function restoreProfileSnapshot(snapshotDir: string, userDataDir: string): ProfileBackupResult {
  if (!existsSync(path.join(snapshotDir, COMPLETE_MARKER))) {
    return { ok: false, error: 'Snapshot is incomplete' }
  }
  if (path.resolve(snapshotDir) === path.resolve(userDataDir)) {
    return { ok: false, error: 'Snapshot path is the live profile' }
  }

  const aside = path.join(userDataDir, 'migration-backups', `before-restore-${Date.now()}`)
  const targets = [PROFILE_STORE_FILE, ...PROFILE_DATA_DIRECTORIES]
  const moved: string[] = []
  try {
    mkdirSync(aside, { recursive: true })
    for (const name of targets) {
      const source = path.join(snapshotDir, name)
      if (!existsSync(source)) continue
      const live = path.join(userDataDir, name)
      if (existsSync(live)) {
        cpSync(live, path.join(aside, name), { recursive: true })
        moved.push(name)
        rmSync(live, { recursive: true, force: true })
      }
      cpSync(source, live, { recursive: true })
    }
    return { ok: true, skipped: false, backupPath: aside }
  } catch (error) {
    for (const name of moved) {
      const backup = path.join(aside, name)
      const live = path.join(userDataDir, name)
      if (!existsSync(backup)) continue
      rmSync(live, { recursive: true, force: true })
      cpSync(backup, live, { recursive: true })
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function snapshotManifestContains(snapshotDir: string, text: string): boolean {
  const manifestPath = path.join(snapshotDir, 'manifest.json')
  if (!existsSync(manifestPath)) return false
  return readFileSync(manifestPath, 'utf8').includes(text)
}

export function directoryByteSize(root: string): number {
  return listFiles(root).reduce((sum, file) => sum + statSync(file).size, 0)
}
