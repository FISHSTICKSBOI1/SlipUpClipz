import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isSupportedAudioFile } from './audioImport.ts'
import { importAudioBatch, type ImportOne } from './importAudioBatch.ts'
import type { Clip, ImportAudioResult } from '../types/clip'

function clip(id: string, name: string): Clip {
  return {
    id,
    name,
    createdAt: 1,
    durationMs: 1000,
    hasAudio: true,
    source: 'imported',
  }
}

describe('New clip and Add Clip import', () => {
  it('does not create a clip when the file picker is cancelled', async () => {
    let calls = 0
    const result = await importAudioBatch(
      [],
      async () => {
        calls += 1
        return { ok: false, error: 'should not run' }
      },
      () => false,
    )
    assert.equal(calls, 0)
    assert.equal(result.error, null)
    assert.equal(result.notice, null)
    assert.deepEqual(result.importedIds, [])
  })

  it('rejects files the soundboard importer cannot use', () => {
    const text = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    const wav = new File([new Uint8Array([1, 2, 3])], 'reaction.wav', { type: 'audio/wav' })
    assert.equal(isSupportedAudioFile(text), false)
    assert.equal(isSupportedAudioFile(wav), true)
  })

  it('imports through the shared handler and refreshes with the new clip id', async () => {
    const calls: string[] = []
    const importOne: ImportOne = async (file, options) => {
      calls.push(`${file.name}:${options?.allowDuplicate ? 'copy' : 'new'}`)
      if (!isSupportedAudioFile(file)) {
        return { ok: false, error: 'Unsupported file type. Please choose an MP3 or WAV file.' }
      }
      return { ok: true, clip: clip('clip-1', 'reaction') }
    }
    const bad = await importAudioBatch(
      [new File(['x'], 'notes.txt', { type: 'text/plain' })],
      importOne,
      () => false,
    )
    assert.match(bad.error ?? '', /Unsupported/)
    assert.deepEqual(bad.importedIds, [])

    const good = await importAudioBatch(
      [new File([new Uint8Array([1])], 'reaction.wav', { type: 'audio/wav' })],
      importOne,
      () => false,
    )
    assert.equal(good.notice, 'Imported reaction.')
    assert.deepEqual(good.importedIds, ['clip-1'])
    assert.deepEqual(calls, ['notes.txt:new', 'reaction.wav:new'])
  })

  it('does not create a second record unless the duplicate is confirmed', async () => {
    const created: string[] = []
    const importOne: ImportOne = async (_file, options) => {
      if (options?.allowDuplicate) {
        created.push('copy')
        return { ok: true, clip: clip('clip-2', 'reaction copy') }
      }
      const duplicate = clip('clip-1', 'reaction')
      return { ok: true, clip: duplicate, duplicateOf: duplicate } satisfies ImportAudioResult
    }
    const file = new File([new Uint8Array([1])], 'reaction.wav', { type: 'audio/wav' })
    const skipped = await importAudioBatch([file], importOne, () => false)
    assert.match(skipped.notice ?? '', /Skipped duplicate/)
    assert.deepEqual(created, [])

    const copied = await importAudioBatch([file], importOne, () => true)
    assert.deepEqual(created, ['copy'])
    assert.deepEqual(copied.importedIds, ['clip-2'])
  })
})
