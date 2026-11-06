import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AI_VOICE_SHOTS } from '../config/aiVoiceShowcase'
import { cropFrameStyle } from './cropFrame'

describe('cropFrameStyle', () => {
  it('maps a pixel crop onto the frame without stretching', () => {
    const frame = cropFrameStyle(
      { x: 628, y: 155, width: 664, height: 755 },
      { width: 1920, height: 1080 },
    )
    assert.equal(frame.aspectRatio, '664 / 755')
    assert.equal(frame.image.left.startsWith('-'), true)
    assert.ok(Number.parseFloat(frame.image.width) > 100)
    assert.ok(Number.parseFloat(frame.image.height) > 100)
  })

  it('frames every AI screenshot as the same 16:9 landscape crop', () => {
    const [first, ...rest] = AI_VOICE_SHOTS
    assert.equal(first.crop.width * 9, first.crop.height * 16)
    for (const shot of rest) {
      assert.equal(shot.crop.width, first.crop.width)
      assert.equal(shot.crop.height, first.crop.height)
      assert.ok(shot.crop.x >= 320)
    }
  })
})
