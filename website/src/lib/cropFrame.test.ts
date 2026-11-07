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

  it('keeps every AI screenshot inside its own 16:9 frame', () => {
    for (const shot of AI_VOICE_SHOTS) {
      assert.equal(shot.crop.width * 9, shot.crop.height * 16)
      assert.ok(shot.crop.x >= 0)
      assert.ok(shot.crop.y >= 0)
      assert.ok(shot.crop.x + shot.crop.width <= shot.imageWidth)
      assert.ok(shot.crop.y + shot.crop.height <= shot.imageHeight)
      assert.doesNotMatch(shot.alt, /three variations/i)
    }
  })
})
