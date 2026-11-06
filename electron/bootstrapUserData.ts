import { app } from 'electron'
import { backupProfileStore, legacyUserDataPath, snapshotCompleteProfile } from './profileBackup.js'

/**
 * Point user data at the v0.1.5 directory before electron-store or Chromium open it.
 * This must stay the first import in main.ts. It does not create a replacement profile
 * and it does not delete an existing one.
 */
const userData = legacyUserDataPath(app.getPath('appData'))
app.setPath('userData', userData)

const backup = backupProfileStore(userData)
if (!backup.ok) {
  console.error(
    '[profile] Could not back up settings. The original files were left in place.',
    backup.error,
  )
}

const snapshot = snapshotCompleteProfile(userData)
if (!snapshot.ok) {
  console.error(
    '[profile] Could not snapshot clips and audio. The original files were left in place.',
    snapshot.error,
  )
}
