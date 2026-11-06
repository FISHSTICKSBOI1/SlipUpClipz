import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generationProgress, generationStatusLabel, warmGenerateMs } from './generationProgress.ts'

describe('AI generation progress', () => {
  it('uses the measured warm time for a short sentence and never reports 100', () => {
    const short = warmGenerateMs(28)
    assert.ok(short >= 6_000 && short <= 7_000)
    const early = generationProgress({
      phase: 'generating',
      elapsedMs: 0,
      coldStart: false,
      textLength: 28,
      completed: 0,
      total: 1,
    })
    const late = generationProgress({
      phase: 'generating',
      elapsedMs: short - 100,
      coldStart: false,
      textLength: 28,
      completed: 0,
      total: 1,
    })
    const done = generationProgress({
      phase: 'finishing',
      elapsedMs: short,
      coldStart: false,
      textLength: 28,
      completed: 0,
      total: 1,
    })
    assert.equal(early.percent, 0)
    assert.equal(early.estimate, true)
    assert.ok((late.percent ?? 0) > (early.percent ?? 0))
    assert.ok((late.percent ?? 100) <= 92)
    assert.equal(done.percent, 96)
    assert.equal(done.estimate, false)
    assert.notEqual(done.percent, 100)
  })

  it('gives a cold start a longer budget than a warm request', () => {
    const warm = generationProgress({
      phase: 'generating',
      elapsedMs: 7_000,
      coldStart: false,
      textLength: 28,
      completed: 0,
      total: 1,
    })
    const cold = generationProgress({
      phase: 'loading',
      elapsedMs: 7_000,
      coldStart: true,
      textLength: 28,
      completed: 0,
      total: 1,
    })
    assert.equal(warm.overrun, true)
    assert.equal(warm.percent, null)
    assert.equal(cold.overrun, false)
    assert.equal(cold.estimate, true)
    assert.ok((cold.percent ?? 0) < 92)
  })

  it('moves by completed variations and drops the percentage when a clip runs long', () => {
    const started = generationProgress({
      phase: 'generating',
      elapsedMs: 0,
      coldStart: false,
      textLength: 28,
      completed: 1,
      total: 3,
    })
    const overrun = generationProgress({
      phase: 'generating',
      elapsedMs: 60_000,
      coldStart: false,
      textLength: 28,
      completed: 1,
      total: 3,
    })
    assert.equal(started.percent, 33)
    assert.equal(started.estimate, true)
    assert.equal(overrun.percent, null)
    assert.equal(overrun.overrun, true)
    assert.equal(overrun.remainingMs, null)
  })

  it('names the real stage and keeps the variation when a run overruns its estimate', () => {
    assert.equal(generationStatusLabel('preparing', false, 'Generating voice...'), 'Preparing AI...')
    assert.equal(generationStatusLabel('loading', false, 'Generating voice...'), 'Starting the voice engine...')
    assert.equal(generationStatusLabel('generating', false, 'Generating variation 2 of 3'), 'Generating variation 2 of 3')
    assert.equal(generationStatusLabel('finishing', false, 'Generating voice...'), 'Finishing audio...')
    assert.equal(generationStatusLabel('generating', true, 'Generating voice...'), 'Still generating voice...')
    assert.equal(generationStatusLabel('generating', true, 'Generating variation 2 of 3'), 'Still generating variation 2 of 3...')
    assert.equal(generationStatusLabel('generating', true, 'Regenerating variation 2'), 'Still regenerating variation 2...')
  })

  it('keeps preparing indeterminate so a fast local step is not called complete', () => {
    const preparing = generationProgress({
      phase: 'preparing',
      elapsedMs: 5_000,
      coldStart: false,
      textLength: 28,
      completed: 0,
      total: 1,
    })
    assert.equal(preparing.percent, null)
    assert.equal(preparing.overrun, false)
  })
})
