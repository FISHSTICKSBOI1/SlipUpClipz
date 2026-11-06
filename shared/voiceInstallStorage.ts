/** Bytes in one gibibyte. Windows Explorer labels this unit GB. */
const WINDOWS_GIB = 1024 ** 3

/**
 * Verified archive size and the same-drive setup check from shared/aiComponentPin.json.
 * The setup check is the archive plus room to extract it, not the size of SlipUpClipz itself.
 */
export const VOICE_CLONING_ARCHIVE_BYTES = 7_707_726_336
export const VOICE_CLONING_MIN_FREE_BYTES = 16_707_726_336

export const STORAGE_CHECK_FAILED_MESSAGE =
  'Could not check free storage for Voice Cloning. Confirm the drive where it installs is available, then try again.'

/**
 * Uncompressed tar contents are about the archive size. The pin adds 9,000,000,000
 * bytes of setup room, which is already above that. Never plan extraction below the archive.
 */
export function extractionAllowanceBytes(archiveBytes: number, minFreeBytes: number): number {
  return Math.max(minFreeBytes - archiveBytes, archiveBytes)
}

/** Archive and extracted copy coexist when the temp file and the runtime are on one drive. */
export function sameVolumeInstallBytes(archiveBytes: number, minFreeBytes: number): number {
  return archiveBytes + extractionAllowanceBytes(archiveBytes, minFreeBytes)
}

/** Whole Windows GB, rounded up so the label is never below the byte check. */
export function approximateInstallGb(requiredBytes: number): number {
  if (!Number.isFinite(requiredBytes) || requiredBytes <= 0) return 0
  return Math.ceil(requiredBytes / WINDOWS_GIB)
}

/** Windows GB rounded down, so the message does not claim more free space than exists. */
export function formatAvailableWindowsGb(freeBytes: number): string {
  if (!Number.isFinite(freeBytes) || freeBytes <= 0) return '0.0 GB'
  const floored = Math.floor((freeBytes / WINDOWS_GIB) * 10) / 10
  return `${floored.toFixed(1)} GB`
}

export function voiceCloningStorageRequirement(requiredBytes: number): string {
  return `Requires approximately ${approximateInstallGb(requiredBytes)} GB of free storage to install Voice Cloning.`
}

export function insufficientVoiceCloningStorage(freeBytes: number, requiredBytes: number): string {
  return `Not enough storage. Voice Cloning needs approximately ${approximateInstallGb(requiredBytes)} GB of free space to install. You currently have ${formatAvailableWindowsGb(freeBytes)} available.`
}

export type VoiceRuntimeState = 'missing' | 'ready' | 'update' | 'repair'

/** Website installs keep the storage note. The wording changes once the engine is on disk. */
export function voiceCloningStorageNoteVisible(distribution: 'website' | 'microsoft-store'): boolean {
  return distribution === 'website'
}

export function voiceCloningStorageNote(requiredBytes: number, runtime: VoiceRuntimeState): string {
  const gb = approximateInstallGb(requiredBytes)
  if (runtime === 'ready') {
    return `Voice Cloning is installed. Setting it up again requires approximately ${gb} GB of free storage.`
  }
  if (runtime === 'update') {
    return `An update is available. Updating Voice Cloning requires approximately ${gb} GB of free storage.`
  }
  return `Requires approximately ${gb} GB of free storage to install Voice Cloning.`
}
