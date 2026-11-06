import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { padPlaybackPlan, voiceMixVerdict, VOICE_MIX_AUDIBLE_PEAK } from './voiceMixDiagnostics.ts'

describe('voice-chat pad routing', () => {
  it('copies a clip onto the new cable context after the old one is replaced', () => {
    const plan = padPlaybackPlan({
      bufferContextId: 'decoded-before-preset',
      voiceContextId: 'cable-context',
      localContextId: 'headphone-context',
      voicePads: true,
      localPads: true,
    })
    assert.deepEqual(
      plan.map((step) => step.destination),
      ['voice', 'local'],
    )
    assert.equal(plan[0]?.copy, true)
    assert.equal(plan[0]?.contextId, 'cable-context')
    assert.equal(plan[1]?.copy, true)
    assert.equal(plan[1]?.contextId, 'headphone-context')
  })

  it('does not send the pad only to the headphones when the cable mix is active', () => {
    const plan = padPlaybackPlan({
      bufferContextId: 'cable-context',
      voiceContextId: 'cable-context',
      localContextId: 'headphone-context',
      voicePads: true,
      localPads: true,
    })
    assert.equal(plan.some((step) => step.destination === 'voice'), true)
    assert.equal(plan[0]?.copy, false)
  })
})

describe('cable versus game', () => {
  it('calls a missing soundboard a routing problem', () => {
    const verdict = voiceMixVerdict({
      tested: true,
      soundboardPeak: 0,
      sinkMatchesCable: true,
    })
    assert.equal(verdict.kind, 'routing')
    assert.match(verdict.message, /did not reach/)
  })

  it('calls a soundboard that reached CABLE Input a game or processing problem', () => {
    const verdict = voiceMixVerdict({
      tested: true,
      soundboardPeak: VOICE_MIX_AUDIBLE_PEAK,
      sinkMatchesCable: true,
    })
    assert.equal(verdict.kind, 'game')
    assert.match(verdict.message, /CABLE Output/)
    assert.match(verdict.message, /cannot change Valorant/)
  })

  it('does not blame the game when the mix is aimed at the wrong device', () => {
    const verdict = voiceMixVerdict({
      tested: true,
      soundboardPeak: 0.4,
      sinkMatchesCable: false,
    })
    assert.equal(verdict.kind, 'wrong-device')
    assert.match(verdict.message, /not CABLE Input/)
  })
})
