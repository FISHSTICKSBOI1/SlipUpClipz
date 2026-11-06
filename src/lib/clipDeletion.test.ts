import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  applySuccessfulClipDeletion,
  clearDeletedClipAssignments,
  CLIP_DELETE_TITLE,
  clipDeleteConfirmationMessage,
  finalizeClipDeletion,
} from './clipDeletion.ts'

describe('clip deletion safety', () => {
  it('explains that deletion is permanent and cannot be undone', () => {
    assert.equal(CLIP_DELETE_TITLE, 'Delete clip?')
    assert.equal(
      clipDeleteConfirmationMessage('Hello there'),
      'Are you sure you want to permanently delete "Hello there"? This cannot be undone.',
    )
    const longName = 'A'.repeat(80)
    assert.match(clipDeleteConfirmationMessage(longName), new RegExp(`"${longName}"`))
  })

  it('keeps the library record when IndexedDB deletion fails', async () => {
    const clips = [{ id: 'clip-1' }, { id: 'clip-2' }]
    const result = await finalizeClipDeletion({
      id: 'clip-1',
      deleteAudio: async () => {
        throw new Error('IndexedDB transaction aborted')
      },
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.preserved, true)
    assert.match(result.error, /IndexedDB transaction aborted/)
    assert.deepEqual(clips, [{ id: 'clip-1' }, { id: 'clip-2' }])
  })

  it('removes the library record and pad assignment only after audio deletion succeeds', async () => {
    let deleted = false
    const result = await finalizeClipDeletion({
      id: 'clip-1',
      deleteAudio: async () => {
        deleted = true
      },
    })
    assert.equal(result.ok, true)
    assert.equal(deleted, true)
    const remaining = applySuccessfulClipDeletion([{ id: 'clip-1' }, { id: 'clip-2' }], 'clip-1')
    assert.deepEqual(remaining, [{ id: 'clip-2' }])
    const pads = clearDeletedClipAssignments(
      [{ clipId: 'clip-1' }, { clipId: 'clip-2' }, { clipId: 'clip-1' }],
      'clip-1',
    )
    assert.deepEqual(pads, [{ clipId: null }, { clipId: 'clip-2' }, { clipId: null }])
  })

  it('leaves Trim Discard as an editor close and waits for IndexedDB before deleting a saved clip', () => {
    const editor = readFileSync(new URL('../components/clips/TrimEditor.tsx', import.meta.url), 'utf8')
    assert.equal(editor.includes('stopPreview()'), true)
    assert.equal(editor.includes('onCancel()'), true)
    assert.equal(editor.includes('deleteClip('), false)
    const library = readFileSync(new URL('../hooks/useClipLibrary.ts', import.meta.url), 'utf8')
    assert.equal(library.includes('finalizeClipDeletion'), true)
    assert.equal(library.includes('await finalizeClipDeletion'), true)
    assert.equal(library.includes('clearDeletedClipFromSoundboard(id)'), true)
    const card = readFileSync(new URL('../components/clips/ClipLibrary.tsx', import.meta.url), 'utf8')
    assert.equal(card.includes('DeleteClipDialog'), true)
    assert.equal(card.includes('confirmClipDeletion'), false)
    assert.equal(card.includes('onDelete={() => {'), false)
    const dialog = readFileSync(new URL('../components/clips/DeleteClipDialog.tsx', import.meta.url), 'utf8')
    assert.equal(dialog.includes('Delete clip?'), true)
    assert.equal(dialog.includes('btn-secondary'), true)
    assert.equal(dialog.includes('btn-danger'), true)
    assert.equal(dialog.includes("event.key === 'Escape'"), true)
    assert.equal(dialog.includes('cancelRef.current?.focus()'), true)
    assert.equal(dialog.includes('break-words'), true)
    assert.equal(dialog.includes("window.addEventListener('keydown', onKeyDown, true)"), true)
    assert.equal(card.includes('source?.focus()'), true)
  })
})
