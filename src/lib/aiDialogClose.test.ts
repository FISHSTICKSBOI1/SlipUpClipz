import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { acceptGenerationResult, aiCloseAction } from './aiDialogClose.ts'

describe('AI dialog close', () => {
  it('closes an idle dialog without a warning', () => {
    assert.equal(aiCloseAction({ generating: false, confirmOpen: false, choice: 'close' }), 'close')
    assert.equal(aiCloseAction({ generating: false, confirmOpen: false, choice: 'escape' }), 'close')
  })

  it('asks before closing during generation', () => {
    assert.equal(aiCloseAction({ generating: true, confirmOpen: false, choice: 'close' }), 'ask')
    assert.equal(aiCloseAction({ generating: true, confirmOpen: false, choice: 'escape' }), 'ask')
  })

  it('keeps the active request when the user stays', () => {
    assert.equal(aiCloseAction({ generating: true, confirmOpen: true, choice: 'keep' }), 'keep')
    assert.equal(aiCloseAction({ generating: true, confirmOpen: true, choice: 'escape' }), 'keep')
    assert.equal(aiCloseAction({ generating: true, confirmOpen: true, choice: 'close' }), 'keep')
  })

  it('stops only after Stop & Close', () => {
    assert.equal(aiCloseAction({ generating: true, confirmOpen: true, choice: 'stop' }), 'stop')
  })

  it('ignores a late result after cancellation and accepts one that is still current', () => {
    assert.equal(acceptGenerationResult({
      requestId: 'gen-1',
      cancelledRequestId: 'gen-1',
      dialogOpen: true,
      clipMatches: true,
    }), false)
    assert.equal(acceptGenerationResult({
      requestId: 'gen-1',
      cancelledRequestId: '',
      dialogOpen: false,
      clipMatches: true,
    }), false)
    assert.equal(acceptGenerationResult({
      requestId: 'gen-2',
      cancelledRequestId: 'gen-1',
      dialogOpen: true,
      clipMatches: true,
    }), true)
  })
})
