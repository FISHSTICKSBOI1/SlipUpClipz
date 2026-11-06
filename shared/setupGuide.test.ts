import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  RECORDING_VERSUS_ROUTING,
  captureGoalPlan,
  captureGoalSettingsPatch,
  isPhysicalMicrophoneLabel,
  recommendSetup,
  voiceChatManualSteps,
} from './setupGuide.ts'

const inputs = [
  { deviceId: 'fifine', label: 'Microphone (fifine Microphone)' },
  { deviceId: 'hyperx', label: 'Microphone (HyperX QuadCast)' },
  { deviceId: 'asus-in', label: 'AI Noise-cancelling Input (ASUS Utility)' },
  { deviceId: 'nvidia', label: 'Microphone (NVIDIA Broadcast)' },
  { deviceId: 'virtual-line', label: 'System Virtual Line (ASUS Utility)' },
  { deviceId: 'cable-out', label: 'CABLE Output (VB-Audio Virtual Cable)' },
  { deviceId: 'asus-out', label: 'AI Noise-cancelling Output (ASUS Utility)' },
]

const outputs = [
  { deviceId: 'cable-in', label: 'CABLE Input (VB-Audio Virtual Cable)' },
  { deviceId: 'cable-16', label: 'CABLE In 16ch (VB-Audio Virtual Cable)' },
  { deviceId: 'phones', label: 'Headset Earphone (Example Headset)' },
  { deviceId: 'fifine-spk', label: 'Speakers (fifine Microphone)' },
]

describe('capture goals', () => {
  it('records playback for teammates and the microphone for yourself', () => {
    const heard = captureGoalPlan('teammates')
    const mine = captureGoalPlan('myself')
    assert.equal(heard.supported, true)
    assert.equal(heard.replayAudioSource, 'system')
    assert.match(heard.summary, /does not isolate/)
    assert.equal(mine.supported, true)
    assert.equal(mine.replayAudioSource, 'microphone')
    assert.deepEqual(captureGoalSettingsPatch('teammates'), { replayAudioSource: 'system' })
    assert.deepEqual(captureGoalSettingsPatch('myself'), { replayAudioSource: 'microphone' })
  })

  it('does not pretend microphone plus system audio already works', () => {
    const both = captureGoalPlan('both')
    assert.equal(both.supported, false)
    assert.equal(both.replayAudioSource, null)
    assert.equal(captureGoalSettingsPatch('both'), null)
    assert.match(both.limitation ?? '', /one source at a time/)
    const patch = captureGoalSettingsPatch('myself')
    assert.equal(patch && 'gamingDiscordPreset' in patch, false)
    assert.equal(patch && 'audioOutputDeviceId' in patch, false)
  })
})

describe('device recommendations', () => {
  it('keeps speakers, cables, and virtual lines out of the microphone list', () => {
    assert.equal(isPhysicalMicrophoneLabel('Microphone (HyperX QuadCast)'), true)
    assert.equal(isPhysicalMicrophoneLabel('Microphone (Blue Yeti)'), true)
    assert.equal(isPhysicalMicrophoneLabel('Speakers (fifine Microphone)'), false)
    assert.equal(isPhysicalMicrophoneLabel('CABLE Output (VB-Audio Virtual Cable)'), false)
    assert.equal(isPhysicalMicrophoneLabel('System Virtual Line (ASUS Utility)'), false)
    assert.equal(isPhysicalMicrophoneLabel('AI Noise-cancelling Output (ASUS Utility)'), false)
  })

  it('uses detected names and skips processor steps when none exist', () => {
    const withProcessor = recommendSetup(inputs, outputs, 'Headset Earphone (Example Headset)')
    assert.equal(withProcessor.cableInput?.deviceId, 'cable-in')
    assert.deepEqual(
      withProcessor.physicalMics.map((device) => device.deviceId),
      ['fifine', 'hyperx'],
    )
    assert.ok(withProcessor.processedMics.some((device) => device.deviceId === 'nvidia'))
    assert.match(withProcessor.processedExplanation ?? '', /NVIDIA Broadcast/)
    assert.equal(withProcessor.headphones.some((device) => device.deviceId === 'fifine-spk'), false)

    const plain = voiceChatManualSteps({
      processedMicrophoneLabel: null,
      physicalMicrophoneLabel: 'Microphone (Logitech G)',
      headphoneLabel: 'Speakers (Realtek)',
    })
    assert.equal(plain.some((step) => /ASUS|Fifine/i.test(step)), false)
    assert.match(plain[0], /CABLE Output/)
    assert.match(plain[0], /CABLE Input/)
  })

  it('names a processed device only when one was detected', () => {
    const steps = voiceChatManualSteps({
      processedMicrophoneLabel: 'Microphone (NVIDIA Broadcast)',
      physicalMicrophoneLabel: 'Microphone (HyperX QuadCast)',
      headphoneLabel: 'Headset Earphone (Example Headset)',
    })
    assert.match(steps[0], /NVIDIA Broadcast/)
    assert.match(steps[0], /HyperX QuadCast/)
    assert.equal(/Fifine/i.test(steps.join(' ')), false)
  })
})

describe('plain-language split', () => {
  it('separates recording from what teammates hear', () => {
    const text = RECORDING_VERSUS_ROUTING.join(' ')
    assert.match(text, /Record what I hear/)
    assert.match(text, /Live Audio Mixer/)
    assert.match(text, /Soundboard clips play in your selected headphones/)
    assert.match(text, /Hear Myself/)
  })
})
