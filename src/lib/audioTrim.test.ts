import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { referenceDurationMsAllowed } from '../../shared/aiReference.ts'
import { requiresProLicense } from '../../shared/appTypes.ts'
import { playbackStartSec, spaceTrimDecision } from './trimPlayback.ts'
import {
  beginEditSession,
  commitRemoval,
  cutMarkerKeyDecision,
  cutModeControls,
  cutModeKeyDecision,
  cutSpanFromMarkers,
  emptyCutMarkers,
  placeCutMarker,
  positionCutCursor,
  encodePcmWav,
  pcmLooksLikeRemoval,
  removePcmSelection,
  removalSaveAction,
  resetEdit,
  TRIM_SAVE_UNVERIFIED_MESSAGE,
  trimSaveOutcome,
  verifyTrimSaveAudio,
  trimSavePlan,
  undoEdit,
  viewAfterRemoval,
  type PcmBlock,
} from './audioTrim.ts'

function tone(seconds: number, sampleRate = 48_000): PcmBlock {
  const length = Math.round(seconds * sampleRate)
  const channel = new Float32Array(length)
  for (let i = 0; i < length; i++) channel[i] = ((i % 100) - 50) / 100
  return { sampleRate, channels: [channel] }
}

function samples(block: PcmBlock): Float32Array {
  return block.channels[0]
}

describe('remove selection', () => {
  it('removes a middle region and joins the remainder', () => {
    const clip = tone(10)
    const removed = removePcmSelection(clip, 3, 7, 0)
    assert.equal(removed.ok, true)
    if (!removed.ok) return
    assert.equal(removed.durationMs, 6000)
    assert.equal(samples(removed.audio).length, 6 * 48_000)
    assert.equal(samples(removed.audio)[0], samples(clip)[0])
    assert.equal(samples(removed.audio)[3 * 48_000], samples(clip)[7 * 48_000])
    assert.equal(samples(removed.audio)[3 * 48_000 - 1], samples(clip)[3 * 48_000 - 1])
  })

  it('removes from the beginning or the end', () => {
    const clip = tone(10)
    const beginning = removePcmSelection(clip, 0, 3, 0)
    const end = removePcmSelection(clip, 7, 10, 0)
    assert.equal(beginning.ok && end.ok, true)
    if (!beginning.ok || !end.ok) return
    assert.equal(beginning.durationMs, 7000)
    assert.equal(end.durationMs, 7000)
    assert.equal(samples(beginning.audio)[0], samples(clip)[3 * 48_000])
    assert.equal(samples(end.audio)[samples(end.audio).length - 1], samples(clip)[7 * 48_000 - 1])
  })

  it('writes a decodable wav whose frames stay in order', () => {
    const clip = tone(10)
    const removed = removePcmSelection(clip, 3, 7, 0)
    assert.equal(removed.ok, true)
    if (!removed.ok) return
    const wav = encodePcmWav(removed.audio)
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
    assert.equal(String.fromCharCode(wav[0], wav[1], wav[2], wav[3]), 'RIFF')
    assert.equal(String.fromCharCode(wav[8], wav[9], wav[10], wav[11]), 'WAVE')
    assert.equal(view.getUint16(20, true), 1)
    assert.equal(view.getUint16(22, true), 1)
    assert.equal(view.getUint32(24, true), 48_000)
    const first = view.getInt16(44, true) / 0x8000
    assert.ok(Math.abs(first - samples(removed.audio)[0]) < 0.001)
    const join = 3 * 48_000
    const joinSample = view.getInt16(44 + join * 2, true) / 0x8000
    assert.ok(Math.abs(joinSample - samples(clip)[7 * 48_000]) < 0.001)
  })

  it('places the playhead at the start of the joined clip', () => {
    const view = viewAfterRemoval(6)
    assert.deepEqual(view, { playheadSec: 0, startSec: 0, endSec: 6 })
  })

  it('undoes one cut and reset restores the original samples', () => {
    const original = tone(10)
    let session = beginEditSession(original)
    const cut = commitRemoval(session, 3, 7, true)
    assert.equal(cut.error, null)
    session = cut.session
    assert.equal(samples(session.current).length, 6 * 48_000)
    session = undoEdit(session)
    assert.equal(samples(session.current).length, samples(original).length)
    assert.equal(samples(session.current)[3 * 48_000], samples(original)[3 * 48_000])
    const again = commitRemoval(beginEditSession(original), 3, 7, true)
    session = resetEdit(again.session)
    assert.equal(session.undo.length, 0)
    assert.equal(samples(session.current), samples(session.original))
  })

  it('saves a ripple cut as a new clip and leaves basic trim on the original', () => {
    assert.equal(trimSavePlan({ hasRemovals: true, isPro: true }), 'new-clip')
    assert.equal(trimSavePlan({ hasRemovals: false, isPro: false }), 'replace-original')
    assert.equal(trimSavePlan({ hasRemovals: false, isPro: true }), 'replace-original')
  })

  it('refuses the cut and the new-clip save for free users', () => {
    const session = beginEditSession(tone(10))
    const cut = commitRemoval(session, 3, 7, false)
    assert.match(cut.error ?? '', /Pro/)
    assert.equal(samples(cut.session.current).length, samples(session.current).length)
    assert.equal(trimSavePlan({ hasRemovals: true, isPro: false }), 'denied')
    assert.equal(requiresProLicense('removeSelection'), true)
  })

  it('rejects a cut that would leave no audio', () => {
    const removed = removePcmSelection(tone(2), 0, 2, 0)
    assert.equal(removed.ok, false)
  })

  it('keeps a six second cut inside the AI Clone reference range', () => {
    const removed = removePcmSelection(tone(10), 3, 7, 0)
    assert.equal(removed.ok, true)
    if (!removed.ok) return
    assert.equal(referenceDurationMsAllowed(removed.durationMs), true)
    assert.equal(referenceDurationMsAllowed(10_000), false)
  })

  it('undoes several cuts, then reset restores the original', () => {
    const original = tone(10)
    let session = beginEditSession(original)
    for (const [start, end] of [
      [1, 2],
      [2, 3],
      [3, 4],
    ] as const) {
      const cut = commitRemoval(session, start, end, true)
      assert.equal(cut.error, null)
      session = cut.session
    }
    assert.equal(session.undo.length, 3)
    assert.equal(samples(session.current).length, 7 * 48_000)
    session = undoEdit(undoEdit(session))
    assert.equal(samples(session.current).length, 9 * 48_000)
    const view = viewAfterRemoval(samples(session.current).length / session.current.sampleRate)
    assert.equal(playbackStartSec(view.playheadSec, view.startSec, view.endSec), 0)
    assert.equal(playbackStartSec(1.5, view.startSec, view.endSec), 1.5)
    session = resetEdit(session)
    assert.equal(session.undo.length, 0)
    assert.equal(samples(session.current)[100], samples(original)[100])
  })

  it('saves a cut as a new clip only after the main process allows it', () => {
    assert.deepEqual(removalSaveAction({ asNewClip: true, mainAllows: false, originalId: 'orig' }), {
      action: 'deny',
    })
    assert.deepEqual(removalSaveAction({ asNewClip: true, mainAllows: true, originalId: 'orig' }), {
      action: 'create',
    })
    assert.deepEqual(removalSaveAction({ asNewClip: false, mainAllows: false, originalId: 'orig' }), {
      action: 'replace',
      id: 'orig',
    })
    const original = (() => {
      const length = 10 * 48_000
      const channel = new Float32Array(length)
      for (let i = 0; i < length; i++) channel[i] = (i / length) * 2 - 1
      return { sampleRate: 48_000, channels: [channel] }
    })()
    const trimmed = {
      sampleRate: original.sampleRate,
      channels: [samples(original).subarray(1 * 48_000, 8 * 48_000)],
    }
    assert.equal(pcmLooksLikeRemoval(original, trimmed, 1, 8), false)
    const cut = removePcmSelection(original, 3, 7, 0)
    assert.equal(cut.ok, true)
    if (cut.ok) {
      assert.equal(pcmLooksLikeRemoval(original, cut.audio, 0, 6), true)
    }
    assert.deepEqual(
      removalSaveAction({
        asNewClip: false,
        mainAllows: false,
        originalId: 'orig',
        looksLikeRemoval: true,
      }),
      { action: 'deny' },
    )
    assert.deepEqual(
      removalSaveAction({
        asNewClip: false,
        mainAllows: true,
        originalId: 'orig',
        looksLikeRemoval: true,
      }),
      { action: 'create' },
    )
    assert.deepEqual(
      removalSaveAction({
        asNewClip: false,
        mainAllows: false,
        originalId: 'orig',
        looksLikeRemoval: false,
      }),
      { action: 'replace', id: 'orig' },
    )
  })

  it('does not save when the edit cannot be decoded or verified', () => {
    const original = (() => {
      const length = 10 * 48_000
      const channel = new Float32Array(length)
      for (let i = 0; i < length; i++) channel[i] = (i / length) * 2 - 1
      return { sampleRate: 48_000, channels: [channel] }
    })()
    assert.deepEqual(verifyTrimSaveAudio({ original: null, saved: original, startSec: 1, endSec: 8 }), {
      ok: false,
    })
    assert.deepEqual(verifyTrimSaveAudio({ original, saved: null, startSec: 1, endSec: 8 }), {
      ok: false,
    })
    assert.deepEqual(
      trimSaveOutcome({
        verified: { ok: false },
        asNewClip: false,
        mainAllows: false,
        originalId: 'orig',
      }),
      { action: 'unverified' },
    )
    assert.deepEqual(
      trimSaveOutcome({
        verified: { ok: false },
        asNewClip: true,
        mainAllows: true,
        originalId: 'orig',
      }),
      { action: 'unverified' },
    )
    assert.match(TRIM_SAVE_UNVERIFIED_MESSAGE, /unchanged/i)
    const source = readFileSync(new URL('../context/ReplayBufferContext.tsx', import.meta.url), 'utf8')
    assert.equal(source.includes('looksLikeRemoval = false'), false)
    assert.equal(source.includes('setSaveError(TRIM_SAVE_UNVERIFIED_MESSAGE)'), true)
  })

  it('still replaces a Free start/end trim after the audio verifies', () => {
    const original = (() => {
      const length = 10 * 48_000
      const channel = new Float32Array(length)
      for (let i = 0; i < length; i++) channel[i] = (i / length) * 2 - 1
      return { sampleRate: 48_000, channels: [channel] }
    })()
    const trimmed = {
      sampleRate: original.sampleRate,
      channels: [samples(original).subarray(1 * 48_000, 8 * 48_000)],
    }
    const verified = verifyTrimSaveAudio({ original, saved: trimmed, startSec: 1, endSec: 8 })
    assert.deepEqual(verified, { ok: true, looksLikeRemoval: false })
    assert.deepEqual(
      trimSaveOutcome({
        verified,
        asNewClip: false,
        mainAllows: false,
        originalId: 'orig',
      }),
      { action: 'replace', id: 'orig' },
    )
  })

  it('still creates a Pro cut as a new clip after the audio verifies', () => {
    const original = (() => {
      const length = 10 * 48_000
      const channel = new Float32Array(length)
      for (let i = 0; i < length; i++) channel[i] = (i / length) * 2 - 1
      return { sampleRate: 48_000, channels: [channel] }
    })()
    const cut = removePcmSelection(original, 3, 7, 0)
    assert.equal(cut.ok, true)
    if (!cut.ok) return
    const verified = verifyTrimSaveAudio({
      original,
      saved: cut.audio,
      startSec: 0,
      endSec: 6,
    })
    assert.deepEqual(verified, { ok: true, looksLikeRemoval: true })
    assert.deepEqual(
      trimSaveOutcome({
        verified,
        asNewClip: true,
        mainAllows: false,
        originalId: 'orig',
      }),
      { action: 'deny' },
    )
    assert.deepEqual(
      trimSaveOutcome({
        verified,
        asNewClip: true,
        mainAllows: true,
        originalId: 'orig',
      }),
      { action: 'create' },
    )
  })

  it('keeps the edited wav duration exact and does not store a transcript on a new clip', () => {
    const removed = removePcmSelection(tone(10), 3, 7, 0)
    assert.equal(removed.ok, true)
    if (!removed.ok) return
    const wav = encodePcmWav(removed.audio)
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
    const dataBytes = view.getUint32(40, true)
    assert.equal(dataBytes, samples(removed.audio).length * 2)
    assert.equal(Math.round((dataBytes / 2 / view.getUint32(24, true)) * 1000), removed.durationMs)
    const library = readFileSync(new URL('../hooks/useClipLibrary.ts', import.meta.url), 'utf8')
    const created = library.slice(library.indexOf('const addClipFromRecording'), library.indexOf('const importAudioFile'))
    assert.equal(created.includes('transcript'), false)
    assert.equal(created.includes('refText'), false)
  })

  it('places the first and second cut markers at the playhead', () => {
    const first = placeCutMarker(emptyCutMarkers(), 3, 10)
    assert.deepEqual(first, { first: 3, second: null })
    const second = placeCutMarker(first, 7, 10)
    assert.deepEqual(second, { first: 3, second: 7 })
    assert.deepEqual(cutSpanFromMarkers(second, 10), { startSec: 3, endSec: 7 })
  })

  it('spans markers placed in reverse order', () => {
    const markers = placeCutMarker(placeCutMarker(emptyCutMarkers(), 7, 10), 3, 10)
    assert.deepEqual(cutSpanFromMarkers(markers, 10), { startSec: 3, endSec: 7 })
  })

  it('seeks, then places a marker with C only while Cut mode owns focus', () => {
    const playhead = playbackStartSec(4.5, 0, 10)
    const marked = placeCutMarker(emptyCutMarkers(), playhead, 10)
    assert.equal(marked.first, 4.5)
    assert.equal(
      cutMarkerKeyDecision({
        cutMode: true,
        editorFocused: true,
        key: 'c',
        repeat: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        editable: false,
      }),
      'place',
    )
    assert.equal(
      cutMarkerKeyDecision({
        cutMode: true,
        editorFocused: false,
        key: 'c',
        repeat: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        editable: false,
      }),
      'ignore',
    )
  })

  it('clears the pair on the third C and can be cleared without cutting', () => {
    const pair = placeCutMarker(placeCutMarker(emptyCutMarkers(), 3, 10), 7, 10)
    const replaced = placeCutMarker(pair, 1, 10)
    assert.deepEqual(replaced, { first: 1, second: null })
    assert.deepEqual(emptyCutMarkers(), { first: null, second: null })
    assert.equal(cutSpanFromMarkers(replaced, 10), null)
  })

  it('removes only the marked section and keeps the surrounding audio', () => {
    const span = cutSpanFromMarkers(placeCutMarker(placeCutMarker(emptyCutMarkers(), 3, 10), 7, 10), 10)
    assert.deepEqual(span, { startSec: 3, endSec: 7 })
    const removed = removePcmSelection(tone(10), span?.startSec ?? 0, span?.endSec ?? 0, 0)
    assert.equal(removed.ok, true)
    if (!removed.ok) return
    assert.equal(samples(removed.audio)[0], samples(tone(10))[0])
    assert.equal(samples(removed.audio)[3 * 48_000], samples(tone(10))[7 * 48_000])
  })

  it('reports the joined duration and refuses an empty or whole-clip marker pair', () => {
    const span = cutSpanFromMarkers({ first: 3, second: 7 }, 10)
    const removed = removePcmSelection(tone(10), span?.startSec ?? 0, span?.endSec ?? 0, 0)
    assert.equal(removed.ok, true)
    if (!removed.ok) return
    assert.equal(removed.durationMs, 6000)
    assert.equal(cutSpanFromMarkers({ first: 4, second: 4 }, 10), null)
    assert.equal(cutSpanFromMarkers({ first: 0, second: 10 }, 10), null)
  })

  it('leaves Space playback alone and does not treat C as play', () => {
    assert.equal(spaceTrimDecision({ tagName: 'DIV' } as unknown as EventTarget, true), 'play')
    assert.equal(
      cutMarkerKeyDecision({
        cutMode: true,
        editorFocused: true,
        key: ' ',
        repeat: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        editable: false,
      }),
      'ignore',
    )
    assert.equal(playbackStartSec(2, 0, 6), 2)
  })

  it('ignores C in text fields, with modifiers, and when the key is held', () => {
    const base = {
      cutMode: true,
      editorFocused: true,
      key: 'c',
      repeat: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      editable: false,
    }
    assert.equal(cutMarkerKeyDecision({ ...base, editable: true }), 'ignore')
    assert.equal(cutMarkerKeyDecision({ ...base, ctrlKey: true }), 'ignore')
    assert.equal(cutMarkerKeyDecision({ ...base, repeat: true }), 'ignore')
    assert.equal(cutMarkerKeyDecision({ ...base, cutMode: false }), 'ignore')
  })

  it('disables unrelated controls during cut mode and restores them afterward', () => {
    const idle = cutModeControls({ cutMode: false, pendingMarkers: false, completedCuts: false })
    assert.equal(idle.playback, true)
    assert.equal(idle.playhead, true)
    assert.equal(idle.trimming, true)
    assert.equal(idle.save, true)
    assert.equal(idle.undo, false)
    assert.equal(idle.clearSelection, false)
    assert.equal(idle.cancel, false)

    const cutting = cutModeControls({ cutMode: true, pendingMarkers: true, completedCuts: false })
    assert.equal(cutting.playback, false)
    assert.equal(cutting.playhead, false)
    assert.equal(cutting.trimming, false)
    assert.equal(cutting.save, false)
    assert.equal(cutting.undo, false)
    assert.equal(cutting.clearSelection, true)
    assert.equal(cutting.cancel, true)

    const restored = cutModeControls({ cutMode: false, pendingMarkers: false, completedCuts: true })
    assert.equal(restored.playback, true)
    assert.equal(restored.playhead, true)
    assert.equal(restored.trimming, true)
    assert.equal(restored.save, true)
    assert.equal(restored.undo, true)
    assert.equal(restored.clearSelection, false)
    assert.equal(restored.cancel, false)
  })

  it('allows undo only after a finished cut when no markers are waiting', () => {
    const pending = cutModeControls({ cutMode: true, pendingMarkers: true, completedCuts: true })
    assert.equal(pending.undo, false)
    assert.equal(pending.save, false)
    const ready = cutModeControls({ cutMode: true, pendingMarkers: false, completedCuts: true })
    assert.equal(ready.undo, true)
    assert.equal(ready.save, true)
    assert.equal(ready.clearSelection, false)
    assert.equal(ready.cancel, true)
  })

  it('allows save as a new clip after a completed cut while cut mode stays on', () => {
    const afterRemove = cutModeControls({
      cutMode: true,
      pendingMarkers: false,
      completedCuts: true,
    })
    assert.equal(afterRemove.save, true)
    assert.equal(afterRemove.playback, false)
    assert.equal(afterRemove.trimming, false)
    assert.equal(afterRemove.cancel, true)

    const secondCutPending = cutModeControls({
      cutMode: true,
      pendingMarkers: true,
      completedCuts: true,
    })
    assert.equal(secondCutPending.save, false)

    const afterSecondRemove = cutModeControls({
      cutMode: true,
      pendingMarkers: false,
      completedCuts: true,
    })
    assert.equal(afterSecondRemove.save, true)

    assert.deepEqual(removalSaveAction({ asNewClip: true, mainAllows: true, originalId: 'orig' }), {
      action: 'create',
    })
    assert.deepEqual(removalSaveAction({ asNewClip: true, mainAllows: false, originalId: 'orig' }), {
      action: 'deny',
    })
  })

  it('places a marker at the cut cursor and leaves the playhead where it is', () => {
    const playhead = 1.25
    const cursor = positionCutCursor(6.5, 10)
    assert.equal(cursor, 6.5)
    assert.equal(positionCutCursor(12, 10), 10)
    assert.equal(positionCutCursor(-2, 10), 0)
    const marked = placeCutMarker(emptyCutMarkers(), cursor, 10)
    assert.equal(marked.first, cursor)
    assert.notEqual(marked.first, playhead)
    const both = placeCutMarker(marked, positionCutCursor(2, 10), 10)
    assert.deepEqual(cutSpanFromMarkers(both, 10), { startSec: 2, endSec: 6.5 })
  })

  it('blocks unrelated keys during cut mode and lets them through after cancel', () => {
    const focused = {
      cutMode: true,
      editorFocused: true,
      key: 'k',
      repeat: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      editable: false,
    }
    assert.equal(cutModeKeyDecision(focused), 'block')
    assert.equal(cutModeKeyDecision({ ...focused, key: ' ' }), 'block')
    assert.equal(cutModeKeyDecision({ ...focused, key: 'c' }), 'place')
    assert.equal(cutModeKeyDecision({ ...focused, key: 'C' }), 'place')
    assert.equal(cutModeKeyDecision({ ...focused, key: 'Escape', editorFocused: false }), 'cancel')
    assert.equal(cutModeKeyDecision({ ...focused, editable: true, key: 'c' }), 'pass')
    assert.equal(cutModeKeyDecision({ ...focused, key: 'c', ctrlKey: true }), 'block')
    assert.equal(cutModeKeyDecision({ ...focused, cutMode: false, key: 'k' }), 'pass')
    assert.equal(cutModeKeyDecision({ ...focused, cutMode: false, key: ' ' }), 'pass')
    assert.equal(cutModeKeyDecision({ ...focused, editorFocused: false, key: 'k' }), 'pass')
  })

  it('keeps the trim editor on the cut-mode lock after a removal', () => {
    const editor = readFileSync(new URL('../components/clips/TrimEditor.tsx', import.meta.url), 'utf8')
    assert.equal(editor.includes('cutModeControls('), true)
    assert.equal(editor.includes('positionCutCursor('), true)
    assert.equal(editor.includes('if (!cutControls.playback) return'), true)
    assert.equal(editor.includes('if (!cutControls.playhead)'), true)
    assert.equal(editor.includes('disabled={!cutControls.trimming}'), true)
    assert.equal(editor.includes('!cutControls.save'), true)
    assert.equal(editor.includes('if (removed) setCutMarkers(emptyCutMarkers())'), true)
    assert.equal(editor.includes('if (removed) cancelCut()'), false)
    assert.equal(editor.includes('placeCutMarker(current, cutCursorSec, durationSec)'), true)
    assert.equal(editor.includes('placeCutMarker(current, playheadSec, durationSec)'), false)
  })

  it('lets space play from the waveform and ignores the editor buttons', () => {
    const waveform = { tagName: 'DIV' } as unknown as EventTarget
    const button = { tagName: 'BUTTON' } as unknown as EventTarget
    const field = { tagName: 'INPUT' } as unknown as EventTarget
    assert.equal(spaceTrimDecision(waveform, true), 'play')
    assert.equal(spaceTrimDecision(button, true), 'ignore')
    assert.equal(spaceTrimDecision(field, true), 'ignore')
    assert.equal(spaceTrimDecision(button, false), 'play')
  })
})
