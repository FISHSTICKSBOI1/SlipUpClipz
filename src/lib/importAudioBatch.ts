import type { ImportAudioResult } from '../types/clip'

export type ImportOne = (
  file: File,
  options?: { allowDuplicate?: boolean },
) => Promise<ImportAudioResult>

export type ImportBatchResult = {
  error: string | null
  notice: string | null
  importedIds: string[]
}

/**
 * Shared by New clip, Add Clip, and Import Audio.
 * A duplicate is skipped unless the caller confirms another copy.
 */
export async function importAudioBatch(
  files: ArrayLike<File>,
  importOne: ImportOne,
  confirmDuplicate: (fileName: string, existingName: string) => boolean,
): Promise<ImportBatchResult> {
  let error: string | null = null
  let notice: string | null = null
  const importedIds: string[] = []

  for (const file of Array.from(files)) {
    const result = await importOne(file)
    if (!result.ok) {
      error = result.error
      continue
    }
    if (result.duplicateOf) {
      const confirmed = confirmDuplicate(file.name, result.duplicateOf.name)
      if (!confirmed) {
        notice = `Skipped duplicate: ${file.name}`
        continue
      }
      const forced = await importOne(file, { allowDuplicate: true })
      if (!forced.ok) {
        error = forced.error
        continue
      }
      importedIds.push(forced.clip.id)
      notice = `Imported another copy of ${file.name}.`
      continue
    }
    importedIds.push(result.clip.id)
    notice = `Imported ${result.clip.name}.`
  }

  return { error, notice, importedIds }
}
