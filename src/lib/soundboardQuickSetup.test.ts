import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { showTeammateDeviceChoices, teammateStatus, teammateStatusText } from './soundboardQuickSetup.ts'

describe('simple soundboard setup', () => {
  it('hides device choices until someone wants teammates to hear sounds', () => {
    assert.equal(
      showTeammateDeviceChoices({
        wantsTeammates: false,
        hasCable: true,
        microphoneReady: false,
        headphonesReady: false,
      }),
      false,
    )
  })

  it('asks only for the missing microphone or headphones', () => {
    assert.equal(
      showTeammateDeviceChoices({
        wantsTeammates: true,
        hasCable: true,
        microphoneReady: false,
        headphonesReady: true,
      }),
      true,
    )
    assert.equal(
      showTeammateDeviceChoices({
        wantsTeammates: true,
        hasCable: true,
        microphoneReady: true,
        headphonesReady: true,
      }),
      false,
    )
  })

  it('does not claim teammates can hear sounds until the route is on', () => {
    assert.equal(teammateStatus({ enabled: false, sending: false, hasCable: true }), 'local')
    assert.equal(teammateStatus({ enabled: true, sending: false, hasCable: false }), 'needs-cable')
    assert.equal(teammateStatus({ enabled: true, sending: true, hasCable: true }), 'on')
    assert.equal(teammateStatusText('on'), 'Sending sounds to voice chat')
    assert.doesNotMatch(teammateStatusText('on'), /teammates can hear/i)
  })
})
