import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hashDeviceSource } from './deviceIdLogic.ts'

describe('device identity', () => {
  it('hashes a stable install id without returning the raw value', () => {
    const guid = '12345678-1234-1234-1234-123456789abc'
    const first = hashDeviceSource(guid)
    const second = hashDeviceSource(guid)
    assert.equal(first, second)
    assert.equal(first.length, 64)
    assert.equal(first.includes(guid), false)
    assert.notEqual(hashDeviceSource('other-computer'), first)
  })
})
