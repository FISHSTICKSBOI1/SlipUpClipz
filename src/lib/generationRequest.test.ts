import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  captureGenerationRequest,
  generationAgainRequest,
  resultsAfterGeneration,
} from './generationRequest.ts'

function snapshotFrom(referenceWav: Uint8Array, referenceSource: Uint8Array) {
  return captureGenerationRequest({
    clipId: 'clip-1',
    referenceWav,
    referenceSource,
    referenceTranscript: 'I am by the door.',
    targetText: 'Help me, guys.',
    startSec: 0,
    endSec: 1.25,
  })
}

function snapshot() {
  return snapshotFrom(Uint8Array.from([9, 8, 7, 6, 5]), Uint8Array.from([1, 2, 3, 4]))
}

describe('single generation results', () => {
  it('adds exactly one result and keeps the previous one', () => {
    const wav = Uint8Array.from([9, 8, 7, 6, 5])
    const first = resultsAfterGeneration([], wav, 'take-1')
    const secondWav = Uint8Array.from([4, 4, 4])
    const both = resultsAfterGeneration(first, secondWav, 'take-2')
    assert.equal(both.length, 2)
    assert.deepEqual(both[0]?.wav, wav)
    assert.deepEqual(both[1]?.wav, secondWav)
    assert.notEqual(both[1]?.wav, secondWav)
  })

  it('leaves previous results in place when generation fails', () => {
    const previous = resultsAfterGeneration([], Uint8Array.from([9, 8, 7, 6, 5]), 'take-1')
    const afterFailure = resultsAfterGeneration(previous, null, 'take-2')
    assert.equal(afterFailure.length, 1)
    assert.equal(afterFailure[0]?.id, 'take-1')
    assert.deepEqual(afterFailure[0]?.wav, Uint8Array.from([9, 8, 7, 6, 5]))
  })
})

describe('Generate Again snapshot', () => {
  it('keeps the reference audio, timestamps, transcript, and target text after the inputs change', () => {
    const referenceWav = Uint8Array.from([9, 8, 7, 6, 5])
    const referenceSource = Uint8Array.from([1, 2, 3, 4])
    const frozen = snapshotFrom(referenceWav, referenceSource)
    referenceWav[0] = 0
    referenceSource[0] = 0
    const again = generationAgainRequest(frozen, referenceSource.slice())
    assert.equal(again.ok, false)

    const current = Uint8Array.from([1, 2, 3, 4])
    const reused = generationAgainRequest(frozen, current)
    assert.equal(reused.ok, true)
    if (!reused.ok) return
    assert.deepEqual(reused.audioWav, Uint8Array.from([9, 8, 7, 6, 5]))
    assert.equal(reused.refText, 'I am by the door.')
    assert.equal(reused.text, 'Help me, guys.')
    assert.equal(reused.language, 'English')
    assert.equal(reused.startSec, 0)
    assert.equal(reused.endSec, 1.25)
  })

  it('repeats the same frozen request', () => {
    const frozen = snapshot()
    const current = Uint8Array.from([1, 2, 3, 4])
    const first = generationAgainRequest(frozen, current)
    const second = generationAgainRequest(frozen, current.slice())
    assert.equal(first.ok && second.ok, true)
    if (!first.ok || !second.ok) return
    assert.deepEqual(first, second)
  })

  it('reports a missing reference instead of substituting another clip', () => {
    const again = generationAgainRequest(snapshot(), null)
    assert.deepEqual(again, {
      ok: false,
      error: 'The original reference clip is no longer available. Generate Again was not run.',
    })
  })

  it('reports a replaced reference instead of using the new audio', () => {
    const again = generationAgainRequest(snapshot(), Uint8Array.from([5, 5, 5, 5]))
    assert.deepEqual(again, {
      ok: false,
      error: 'The original reference clip has changed. Generate Again was not run.',
    })
  })
})
