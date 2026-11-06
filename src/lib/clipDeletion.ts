export type ClipDeletionResult =
  | { ok: true; id: string }
  | { ok: false; id: string; error: string; preserved: true }

export const CLIP_DELETE_TITLE = 'Delete clip?'

export function clipDeleteConfirmationMessage(clipName: string): string {
  return `Are you sure you want to permanently delete "${clipName}"? This cannot be undone.`
}

export async function finalizeClipDeletion(input: {
  id: string
  deleteAudio: (id: string) => Promise<void>
}): Promise<ClipDeletionResult> {
  try {
    await input.deleteAudio(input.id)
    return { ok: true, id: input.id }
  } catch (caught) {
    const error = caught instanceof Error && caught.message.trim()
      ? caught.message
      : 'The clip audio could not be deleted. The library entry was left in place.'
    return { ok: false, id: input.id, error, preserved: true }
  }
}

export function applySuccessfulClipDeletion<T extends { id: string }>(
  clips: T[],
  id: string,
): T[] {
  return clips.filter((clip) => clip.id !== id)
}

export function clearDeletedClipAssignments<T extends { clipId: string | null }>(
  pads: T[],
  deletedId: string,
): T[] {
  let changed = false
  const next = pads.map((pad) => {
    if (pad.clipId !== deletedId) return pad
    changed = true
    return { ...pad, clipId: null }
  })
  return changed ? next : pads
}
