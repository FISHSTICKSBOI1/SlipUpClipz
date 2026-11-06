/**
 * Restore a pre-upgrade SlipUpClipz profile while the app is closed.
 *
 * Usage, from the project folder, on the Windows account that owns the profile:
 *   npx tsx scripts/restore-slipupclipz-profile.ts
 *
 * Optional:
 *   --user-data "C:\\Users\\<account>\\AppData\\Roaming\\slipupclipz"
 *   --snapshot  "C:\\Users\\<account>\\AppData\\Roaming\\slipupclipz\\migration-backups\\pre-upgrade"
 *
 * This does not run unless you start it. It refuses to run while SlipUpClipz.exe is open.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { restoreProfileSnapshot } from '../electron/profileBackup.ts'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function appIsRunning(): boolean {
  if (process.platform !== 'win32') return false
  const output = execFileSync('tasklist', ['/FI', 'IMAGENAME eq SlipUpClipz.exe', '/FO', 'CSV', '/NH'], {
    encoding: 'utf8',
  })
  return output.toLowerCase().includes('slipupclipz.exe')
}

const appData = process.env.APPDATA
const userData = arg('--user-data') || (appData ? path.join(appData, 'slipupclipz') : '')
const snapshot = arg('--snapshot') || (userData ? path.join(userData, 'migration-backups', 'pre-upgrade') : '')

if (!userData || !snapshot) {
  console.error('Could not find the profile path. Pass --user-data and --snapshot.')
  process.exit(1)
}
if (appIsRunning()) {
  console.error('Close SlipUpClipz first. Restoring while it is open can corrupt the profile.')
  process.exit(1)
}
if (!existsSync(path.join(snapshot, 'COMPLETE'))) {
  console.error(`No completed snapshot at ${snapshot}`)
  process.exit(1)
}

const result = restoreProfileSnapshot(snapshot, userData)
if (!result.ok) {
  console.error(result.error)
  process.exit(1)
}
console.log('Restored the profile. The previous files were copied to:')
console.log(result.backupPath)
console.log('The snapshot was left in place.')
