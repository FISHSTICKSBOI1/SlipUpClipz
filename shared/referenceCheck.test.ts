import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { inspectReferencePcm, transcriptAccuracyWarning } from './referenceCheck.ts'

const RATE = 24_000

function tone(seconds: number, amplitude: number): Float32Array {
  const samples = new Float32Array(Math.round(seconds * RATE))
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin((index / RATE) * Math.PI * 2 * 180) * amplitude
  }
  return samples
}

describe('AI reference check', () => {
  it('suggests a 2–3 second phrase without rejecting a usable 1 second clip', () => {
    const warnings = inspectReferencePcm(tone(1, 0.2), RATE)
    assert.equal(warnings.some((warning) => warning.code === 'short'), true)
    assert.equal(warnings.some((warning) => warning.code === 'invalid'), false)
  })

  it('warns when peaks are flattened and when the edges are cut off', () => {
    const clipped = tone(2.4, 1)
    assert.equal(inspectReferencePcm(clipped, RATE).some((warning) => warning.code === 'clipping'), true)

    const cut = tone(2.4, 0.15)
    cut.fill(0.4, 0, 500)
    assert.equal(inspectReferencePcm(cut, RATE).some((warning) => warning.code === 'cutoff'), true)
  })

  it('warns about silence and unreadable audio', () => {
    const quiet = new Float32Array(RATE * 2.2)
    quiet.fill(0.2, RATE, RATE + 2000)
    assert.equal(inspectReferencePcm(quiet, RATE).some((warning) => warning.code === 'silence'), true)
    assert.equal(inspectReferencePcm(new Float32Array(), RATE)[0]?.code, 'invalid')
  })

  it('asks for a transcript review on short or uncertain text and still allows generation', () => {
    assert.match(
      transcriptAccuracyWarning({ durationSec: 1, status: 'ready' }) ?? '',
      /under 2 seconds/,
    )
    assert.match(
      transcriptAccuracyWarning({ durationSec: 3, status: 'review' }) ?? '',
      /wrong word/,
    )
    assert.equal(transcriptAccuracyWarning({ durationSec: 3, status: 'ready' }), null)
  })
})
