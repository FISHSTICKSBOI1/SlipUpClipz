import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { uniqueClipName } from '../src/lib/clipNames.ts'

describe('uniqueClipName', () => {
  it('keeps a name that is not already used', () => {
    assert.equal(uniqueClipName('AI - door 1', new Set()), 'AI - door 1')
  })

  it('adds a suffix instead of reusing an existing name', () => {
    const taken = new Set(['ai - door 1', 'ai - door 1 (2)'])
    assert.equal(uniqueClipName('AI - door 1', taken), 'AI - door 1 (3)')
  })

  it('treats names as case-insensitive', () => {
    assert.equal(uniqueClipName('AI - Door', new Set(['ai - door'])), 'AI - Door (2)')
  })
})
