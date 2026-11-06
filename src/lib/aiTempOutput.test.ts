import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  canUnlinkTempAiOutput,
  cleanupTempAiOutputs,
  createTempOutputRecord,
  isHistoricalUuidWav,
  nextTempOutputPhase,
  scanAiOutputForCleanup,
  scanOrphanSessionTempWavs,
} from './aiTempOutput.ts'

const sessionId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const otherSession = 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('temporary AI output cleanup', () => {
  it('removes an abandoned preview after the bytes are already in the renderer', () => {
    const record = createTempOutputRecord(sessionId, '1'.repeat(32), 'abandoned')
    const files = new Set([record.filename, `${'a'.repeat(32)}.wav`, 'compare-20260101-t1.05.wav'])
    const result = cleanupTempAiOutputs({
      records: [record],
      sessionId,
      unlink: (filename) => files.delete(filename),
    })
    assert.deepEqual(result.removed, [record.filename])
    assert.equal(files.has(record.filename), false)
    assert.equal(files.has(`${'a'.repeat(32)}.wav`), true)
    assert.equal(files.has('compare-20260101-t1.05.wav'), true)
  })

  it('keeps a successfully saved clip playable from IndexedDB, not the temp WAV', () => {
    let phase = nextTempOutputPhase('generating', 'preview-ready')
    phase = nextTempOutputPhase(phase, 'save-started')
    phase = nextTempOutputPhase(phase, 'saved')
    const record = createTempOutputRecord(sessionId, '2'.repeat(32), phase)
    const decision = canUnlinkTempAiOutput(record, sessionId)
    assert.equal(decision.ok, true)
    assert.equal(isHistoricalUuidWav(record.filename), false)
  })

  it('does not unlink a file while it is generating, previewing, or saving', () => {
    for (const phase of ['generating', 'previewing', 'saving'] as const) {
      const record = createTempOutputRecord(sessionId, '3'.repeat(32), phase)
      const decision = canUnlinkTempAiOutput(record, sessionId)
      assert.equal(decision.ok, false)
      if (!decision.ok) assert.match(decision.reason, /still/)
    }
  })

  it('treats a crash during generation as interrupted and only then allows cleanup', () => {
    const generating = createTempOutputRecord(sessionId, '4'.repeat(32), 'generating')
    assert.equal(canUnlinkTempAiOutput(generating, sessionId).ok, false)
    const interruptedPhase = nextTempOutputPhase(generating.phase, 'interrupted')
    const interrupted = { ...generating, phase: interruptedPhase }
    assert.equal(canUnlinkTempAiOutput(interrupted, sessionId).ok, true)
  })

  it('keeps the file when unlink fails and never touches another session or historical UUID WAV', () => {
    const abandoned = createTempOutputRecord(sessionId, '5'.repeat(32), 'abandoned')
    const other = createTempOutputRecord(otherSession, '6'.repeat(32), 'abandoned')
    const historical = `${'b'.repeat(32)}.wav`
    const failed = cleanupTempAiOutputs({
      records: [abandoned, other],
      sessionId,
      unlink: (filename) => {
        if (filename === abandoned.filename) throw new Error('disk busy')
        return true
      },
    })
    assert.deepEqual(failed.removed, [])
    assert.equal(failed.kept.some((entry) => entry.filename === abandoned.filename && entry.reason === 'unlink failed'), true)
    assert.equal(canUnlinkTempAiOutput(other, sessionId).ok, false)

    const scan = scanAiOutputForCleanup({
      filenames: [abandoned.filename, historical, 'nonstream-matrix.wav', 'model.safetensors'],
      sessionId,
    })
    assert.deepEqual(scan.eligible, [abandoned.filename])
    assert.deepEqual(scan.reviewLater, [historical, 'nonstream-matrix.wav', 'model.safetensors'])

    const orphans = scanOrphanSessionTempWavs([
      abandoned.filename,
      other.filename,
      historical,
      '../outside.wav',
      'compare-20260101-t1.05.wav',
    ])
    assert.deepEqual(orphans.eligible, [abandoned.filename, other.filename])
    assert.deepEqual(orphans.reviewLater, [historical, '../outside.wav', 'compare-20260101-t1.05.wav'])
  })

  it('sends temporary preview requests from the AI dialog and still copies saved audio into IndexedDB', () => {
    const dialog = readFileSync(new URL('../components/clips/AIVoiceDialog.tsx', import.meta.url), 'utf8')
    assert.equal(dialog.includes('temporary: true'), true)
    assert.equal(dialog.includes('sessionId: generationSessionId.current'), true)
    const library = readFileSync(new URL('../hooks/useClipLibrary.ts', import.meta.url), 'utf8')
    assert.equal(library.includes("aiGenerated: options.aiGenerated ?? false"), true)
    assert.equal(library.includes('await saveAudioBlob(id, blob, mimeType)'), true)
  })
})
