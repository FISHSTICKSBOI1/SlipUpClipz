import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FREE_SOUNDBOARD_PAD_LIMIT,
  PRO_SOUNDBOARD_PAD_LIMIT,
  isSoundboardPadUnlocked,
  requiresProLicense,
  soundboardPadLimit,
} from './appTypes.ts'
import { EXTERNAL_LINKS, isAllowedExternalUrl } from './externalLinks.ts'
import { readUpgradeFocus, upgradeNavigationState } from './upgradeNavigation.ts'

describe('free and pro entitlements', () => {
  it('gives free users 7 pads and pro users 50', () => {
    assert.equal(FREE_SOUNDBOARD_PAD_LIMIT, 7)
    assert.equal(PRO_SOUNDBOARD_PAD_LIMIT, 50)
    assert.equal(soundboardPadLimit(false), 7)
    assert.equal(soundboardPadLimit(true), 50)
  })

  it('locks only the 8th free pad and keeps all 50 pro pads', () => {
    for (let index = 0; index < 7; index += 1) {
      assert.equal(isSoundboardPadUnlocked(index, false), true)
    }
    assert.equal(isSoundboardPadUnlocked(7, false), false)
    assert.equal(isSoundboardPadUnlocked(49, true), true)
    assert.equal(isSoundboardPadUnlocked(50, true), false)
  })

  it('keeps hotkeys, VB-Cable routing, and Windows startup free', () => {
    assert.equal(requiresProLicense('globalHotkeys'), false)
    assert.equal(requiresProLicense('vbCableRouting'), false)
    assert.equal(requiresProLicense('autoStart'), false)
  })

  it('uses the same Pro decision for one generation and the 50 pads', () => {
    function proFeatures(isPro: boolean) {
      return {
        singleGeneration: isPro && requiresProLicense('aiVoice'),
        pads: soundboardPadLimit(isPro),
      }
    }

    assert.deepEqual(proFeatures(true), { singleGeneration: true, pads: 50 })
    assert.deepEqual(proFeatures(false), { singleGeneration: false, pads: 7 })
  })
})

describe('upgrade navigation', () => {
  it('issues a new focus token on every click', () => {
    const first = upgradeNavigationState()
    const second = upgradeNavigationState()
    assert.notEqual(first.upgradeFocus, second.upgradeFocus)
    assert.equal(readUpgradeFocus(second), second.upgradeFocus)
    assert.equal(readUpgradeFocus(null), null)
    assert.equal(readUpgradeFocus({ upgradeFocus: 'license' }), null)
  })

  it('opens the official pricing page', () => {
    assert.equal(EXTERNAL_LINKS.pricing, 'https://slipupclipz.com/pricing')
    assert.equal(isAllowedExternalUrl(EXTERNAL_LINKS.pricing), true)
  })
})
