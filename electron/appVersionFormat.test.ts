import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatDisplayedVersion } from './appVersionFormat.ts'

describe('formatDisplayedVersion', () => {
  it('shows the packaged version unchanged', () => {
    assert.equal(formatDisplayedVersion('0.1.5', true), '0.1.5')
  })

  it('marks an unpackaged build so it is not shown as a release', () => {
    assert.equal(formatDisplayedVersion('0.1.5', false), '0.1.5-dev')
  })

  it('does not add a second dev suffix', () => {
    assert.equal(formatDisplayedVersion('0.1.5-dev', false), '0.1.5-dev')
  })
})
