import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  colorRefFromHex,
  nextModalDepth,
  scrimCaptionHex,
} from './windowsCaptionColor.ts'

describe('modal caption color', () => {
  it('blends the scrim over the app surface', () => {
    assert.equal(scrimCaptionHex(0.6), '#06070a')
    assert.equal(scrimCaptionHex(0.7), '#040508')
  })

  it('stores the color as a Windows COLORREF', () => {
    assert.equal(colorRefFromHex('#05060a'), 0x000a0605)
    assert.equal(colorRefFromHex('#ffffff'), 0x00ffffff)
  })

  it('counts nested dialogs and does not go below zero', () => {
    assert.equal(nextModalDepth(0, true), 1)
    assert.equal(nextModalDepth(1, true), 2)
    assert.equal(nextModalDepth(2, false), 1)
    assert.equal(nextModalDepth(0, false), 0)
  })
})
