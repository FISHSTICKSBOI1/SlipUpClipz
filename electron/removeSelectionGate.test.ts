import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { authorizeRemoveSelection } from './removeSelectionGate.ts'

describe('remove selection entitlement', () => {
  it('denies a Free user in the main-process check', () => {
    const result = authorizeRemoveSelection(false)
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /Pro/)
  })

  it('allows a Pro user, including development Pro when that flag is already resolved', () => {
    assert.deepEqual(authorizeRemoveSelection(true), { ok: true })
  })
})
