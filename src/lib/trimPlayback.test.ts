import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { playbackStartSec, spaceTrimDecision, spaceTogglesTrimPlayback } from './trimPlayback.ts'

describe('trim space playback', () => {
  it('starts at the selected playhead instead of the old selection start', () => {
    assert.equal(playbackStartSec(4.25, 1, 8), 4.25)
    assert.equal(playbackStartSec(0.2, 1, 8), 1)
    assert.equal(playbackStartSec(9, 1, 8), 8)
  })

  it('ignores space while typing or while the editor Play button has focus', () => {
    assert.equal(spaceTogglesTrimPlayback({ tagName: 'INPUT' } as unknown as EventTarget), false)
    assert.equal(spaceTogglesTrimPlayback({ tagName: 'TEXTAREA' } as unknown as EventTarget), false)
    assert.equal(spaceTogglesTrimPlayback({ tagName: 'BUTTON' } as unknown as EventTarget, true), false)
    assert.equal(
      spaceTogglesTrimPlayback({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget),
      false,
    )
    assert.equal(spaceTogglesTrimPlayback({ tagName: 'DIV' } as unknown as EventTarget), true)
    assert.equal(spaceTogglesTrimPlayback(null), true)
  })

  it('does not let the Trim button that opened the editor consume Space', () => {
    const trimButton = { tagName: 'BUTTON' } as unknown as EventTarget
    assert.equal(spaceTrimDecision(trimButton, false), 'play')
    assert.equal(spaceTogglesTrimPlayback(trimButton, false), true)
  })
})
