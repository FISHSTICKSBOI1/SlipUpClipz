import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { tourStepsFor } from './onboardingTour.ts'

describe('onboarding tour', () => {
  it('keeps capture, trim, soundboard, and hotkey, and adds AI only for Pro', () => {
    const free = tourStepsFor(false).map((step) => step.id)
    const pro = tourStepsFor(true).map((step) => step.id)
    for (const id of ['clips-overview', 'trim-clip', 'clip-hotkey', 'soundboard-pads', 'finish']) {
      assert.equal(free.includes(id as never), true)
      assert.equal(pro.includes(id as never), true)
    }
    assert.equal(free.includes('ai-voice'), false)
    assert.equal(pro.includes('ai-voice'), true)
    assert.equal(pro.at(-1), 'finish')

    const replay = tourStepsFor(false).find((step) => step.id === 'replay-source')
    assert.equal(replay?.description.includes('or both'), false)
    assert.equal(/asus|fifine/i.test(tourStepsFor(false).map((step) => step.description).join(' ')), false)
  })
})
