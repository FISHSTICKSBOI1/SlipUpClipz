import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MAX_REFERENCE_TEXT_CHARS,
  MAX_WAV_BYTES,
  referenceDurationMsAllowed,
  referenceSecondsAllowed,
  referenceWavBytes,
  referenceWavFrameCount,
} from '../shared/aiReference.js'

const VERIFIED_7S =
  "I'm by the door waiting for you to come back. I thought you were coming from the other direction, but I guess you went around the building instead."
const VERIFIED_5S =
  "I'm by the door waiting for you to come back. I thought you were coming from the other direction, but I guess"

describe('AI Clone reference duration', () => {
  it('accepts the measured reference lengths and the old 3.1 second maximum', () => {
    for (const seconds of [0.8, 0.94, 1, 1.98, 3.06, 3.1, 5.18, 6.96, 7]) {
      assert.equal(referenceSecondsAllowed(seconds), true, String(seconds))
      assert.equal(referenceWavFrameCount(seconds), Math.round(seconds * 24_000))
      assert.ok(referenceWavBytes(seconds) < MAX_WAV_BYTES)
    }
  })

  it('keeps clips shorter than 0.8 seconds rejected', () => {
    assert.equal(referenceSecondsAllowed(0.79), false)
    assert.equal(referenceSecondsAllowed(0.799), false)
    assert.equal(referenceDurationMsAllowed(799), false)
    assert.equal(referenceDurationMsAllowed(800), true)
  })

  it('rejects recordings over 7.0 seconds', () => {
    assert.equal(referenceSecondsAllowed(7.01), false)
    assert.equal(referenceSecondsAllowed(7.05), false)
    assert.equal(referenceSecondsAllowed(10.131), false)
    assert.equal(referenceDurationMsAllowed(7000), true)
    assert.equal(referenceDurationMsAllowed(7001), false)
    assert.equal(referenceDurationMsAllowed(3100), true)
  })

  it('fits the verified 5 and 7 second transcripts without cutting them', () => {
    assert.ok(VERIFIED_5S.length < MAX_REFERENCE_TEXT_CHARS)
    assert.ok(VERIFIED_7S.length < MAX_REFERENCE_TEXT_CHARS)
    assert.equal(VERIFIED_7S.slice(0, MAX_REFERENCE_TEXT_CHARS), VERIFIED_7S)
  })
})
