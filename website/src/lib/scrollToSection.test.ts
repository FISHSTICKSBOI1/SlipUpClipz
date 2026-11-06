import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AI_VOICE_SECTION_ID, scrollBehavior } from './scrollToSection'

describe('scrollToSection', () => {
  it('uses a stable id for the AI Voice Cloning section', () => {
    assert.equal(AI_VOICE_SECTION_ID, 'ai-voice-cloning')
  })

  it('respects reduced motion', () => {
    assert.equal(scrollBehavior(true), 'auto')
    assert.equal(scrollBehavior(false), 'smooth')
  })
})
