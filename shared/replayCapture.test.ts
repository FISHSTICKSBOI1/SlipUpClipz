import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  appendPcmBlock,
  canCaptureClip,
  captureDeviceMatches,
  classifyMicTest,
  copyRecentFrames,
  createPcmRing,
  decodeWavPcm16,
  encodePcmWav,
  inputDeviceStillPresent,
  microphoneChoicePatch,
  replayMicrophoneStatus,
  microphoneTrackConstraints,
  microphoneUnavailableMessage,
  normalizeAudioInputDeviceId,
  openedWrongMicrophoneMessage,
  replayWindowSeconds,
  shouldRestartCapture,
  SILENT_MIC_TEST_MESSAGE,
  validateWavRecording,
} from './replayCapture.ts'

function ramp(start: number, count: number): Float32Array {
  const samples = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    samples[index] = ((start + index) % 200) / 400
  }
  return samples
}

function sameSample(actual: number | undefined, expected: number): void {
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-6)
}

describe('rolling PCM replay buffer', () => {
  it('keeps the latest window after several buffer lengths have passed', () => {
    const ring = createPcmRing(1000, 1, 1)
    appendPcmBlock(ring, [ramp(0, 3500)])

    const recent = copyRecentFrames(ring, 1)
    assert.equal(recent[0]?.length, 1000)
    sameSample(recent[0]?.[0], (2500 % 200) / 400)
    sameSample(recent[0]?.[999], (3499 % 200) / 400)
    assert.notEqual(recent[0]?.[0], ramp(0, 1)[0])
  })

  it('preserves audio across a rollover without dropping the newest samples', () => {
    const ring = createPcmRing(1000, 1, 2)
    appendPcmBlock(ring, [ramp(0, 2000)])
    const before = copyRecentFrames(ring, 2)
    appendPcmBlock(ring, [ramp(2000, 500)])
    const after = copyRecentFrames(ring, 2)

    assert.equal(after[0]?.length, 2000)
    sameSample(after[0]?.[0], before[0]?.[500])
    sameSample(after[0]?.[1999], (2499 % 200) / 400)
    assert.equal(ring.stored, 2000)
  })

  it('keeps earlier audio when a microphone test copies the recent window', () => {
    const ring = createPcmRing(1000, 1, 5)
    appendPcmBlock(ring, [ramp(0, 2000)])
    const duringTest = copyRecentFrames(ring, 1)
    appendPcmBlock(ring, [ramp(2000, 1000)])
    const clip = copyRecentFrames(ring, 3)

    assert.equal(duringTest[0]?.length, 1000)
    assert.equal(clip[0]?.length, 3000)
    sameSample(clip[0]?.[0], (0 % 200) / 400)
    sameSample(clip[0]?.[2999], (2999 % 200) / 400)
    assert.equal(ring.stored, 3000)
  })

  it('encodes a complete WAV whose duration and samples match the captured window', () => {
    const ring = createPcmRing(8000, 1, 3)
    appendPcmBlock(ring, [ramp(0, 8000)])
    appendPcmBlock(ring, [ramp(8000, 8000)])
    appendPcmBlock(ring, [ramp(16000, 4000)])
    const windowSeconds = replayWindowSeconds(1)
    const recent = copyRecentFrames(ring, windowSeconds)
    const wav = encodePcmWav(recent, ring.sampleRate)
    const validation = validateWavRecording(wav)

    assert.equal(validation.ok, true)
    if (!validation.ok) return
    assert.equal(validation.durationMs, 1000)
    assert.equal(validation.frameCount, 8000)
    assert.equal(wav[0], 'R'.charCodeAt(0))
    const decoded = decodeWavPcm16(wav)
    assert.equal(decoded[0]?.length, 8000)
    assert.ok(Math.abs((decoded[0]?.[0] ?? 0) - (recent[0]?.[0] ?? 0)) < 1 / 32767)
    assert.ok(Math.abs((decoded[0]?.[7999] ?? 0) - (recent[0]?.[7999] ?? 0)) < 1 / 32767)
  })

  it('captures a short clip immediately after recording starts', () => {
    const ring = createPcmRing(16000, 1, 30)
    appendPcmBlock(ring, [ramp(10, 80)])
    const recent = copyRecentFrames(ring, replayWindowSeconds(15))
    const validation = validateWavRecording(encodePcmWav(recent, ring.sampleRate))
    assert.equal(validation.ok, true)
    if (!validation.ok) return
    assert.equal(validation.frameCount, 80)
    assert.equal(validation.durationMs, 5)
  })

  it('rejects a headerless or unrelated chunk instead of treating it as playable audio', () => {
    const cluster = Uint8Array.from([0x1f, 0x43, 0xb6, 0x75, 0, 1, 2, 3, 4])
    const validation = validateWavRecording(cluster)
    assert.equal(validation.ok, false)
    if (validation.ok) return
    assert.match(validation.error, /WAV/)
    assert.notEqual(validation.error, SILENT_MIC_TEST_MESSAGE)
  })
})

describe('microphone selection', () => {
  it('stores a device id and leaves an older save with no id on the system default', () => {
    assert.equal(normalizeAudioInputDeviceId(undefined), null)
    assert.equal(normalizeAudioInputDeviceId(' default '), null)
    assert.equal(normalizeAudioInputDeviceId(' mic-external '), 'mic-external')
  })

  it('asks both capture paths for the same exact device', () => {
    const replay = microphoneTrackConstraints('mic-external', 'replay')
    const monitor = microphoneTrackConstraints('mic-external', 'monitor')
    assert.deepEqual(replay.deviceId, { exact: 'mic-external' })
    assert.deepEqual(monitor.deviceId, { exact: 'mic-external' })
    assert.equal(replay.autoGainControl, true)
    assert.equal(monitor.autoGainControl, false)
    assert.equal('deviceId' in microphoneTrackConstraints(null, 'replay'), false)
  })

  it('does not accept a different opened device or a missing selected device', () => {
    assert.equal(captureDeviceMatches('mic-external', 'headset'), false)
    assert.equal(captureDeviceMatches('mic-external', 'default'), false)
    assert.equal(captureDeviceMatches('mic-external', 'mic-external'), true)
    assert.equal(captureDeviceMatches(null, 'headset'), true)
    assert.equal(inputDeviceStillPresent('mic-external', [{ deviceId: 'headset' }]), false)
    assert.equal(inputDeviceStillPresent(null, []), true)
    assert.match(microphoneUnavailableMessage('External mic'), /did not switch/)
    assert.match(openedWrongMicrophoneMessage('Headset Microphone'), /Headset Microphone/)
  })
})

describe('microphone test and capture availability', () => {
  it('does not restart capture while a microphone test is running', () => {
    assert.equal(shouldRestartCapture({ isTestingMic: true, trackLive: false, capturing: false }), false)
    assert.equal(shouldRestartCapture({ isTestingMic: false, trackLive: false, capturing: true }), true)
    assert.equal(shouldRestartCapture({ isTestingMic: false, trackLive: true, capturing: true }), false)
  })

  it('reports a decode failure separately from silence', () => {
    const undecodable = classifyMicTest({
      frameCount: 48000,
      peak: 0.4,
      decodeError: 'Recording is not a WAV file (missing RIFF header).',
    })
    assert.equal(undecodable.kind, 'undecodable')
    if (undecodable.kind !== 'undecodable') return
    assert.notEqual(undecodable.message, SILENT_MIC_TEST_MESSAGE)

    const silent = classifyMicTest({ frameCount: 48000, peak: 0 })
    assert.equal(silent.kind, 'silent')
    const empty = classifyMicTest({ frameCount: 0, peak: 0 })
    assert.equal(empty.kind, 'empty')
    if (empty.kind !== 'empty') return
    assert.notEqual(empty.message, SILENT_MIC_TEST_MESSAGE)
  })

  it('keeps the microphone choice without changing the replay source', () => {
    assert.deepEqual(microphoneChoicePatch('asus-in'), { audioInputDeviceId: 'asus-in' })
    assert.deepEqual(microphoneChoicePatch(''), { audioInputDeviceId: null })
    const system = replayMicrophoneStatus({
      source: 'system',
      savedPresent: true,
      savedLabel: 'AI Noise-cancelling Input',
      listening: true,
      activeLabel: 'System audio',
    })
    assert.match(system.saved, /AI Noise-cancelling Input/)
    assert.match(system.active, /system audio/)
    assert.doesNotMatch(system.active, /Active microphone/)
    const live = replayMicrophoneStatus({
      source: 'microphone',
      savedPresent: true,
      savedLabel: 'Fifine',
      listening: true,
      activeLabel: 'Microphone (Fifine)',
    })
    assert.match(live.saved, /Fifine/)
    assert.match(live.active, /Microphone \(Fifine\)/)
    const missing = replayMicrophoneStatus({
      source: 'microphone',
      savedPresent: false,
      savedLabel: 'saved device',
      listening: false,
      activeLabel: null,
    })
    assert.match(missing.saved, /not available/)
    assert.match(missing.saved, /not replaced/)
  })

  it('uses one availability rule for the Clip button and both hotkeys', () => {
    const blocked = { isListening: true, isSaving: false, isTestingMic: true }
    assert.equal(canCaptureClip(blocked), false)
    assert.equal(canCaptureClip({ isListening: true, isSaving: true, isTestingMic: false }), false)
    assert.equal(canCaptureClip({ isListening: false, isSaving: false, isTestingMic: false }), false)
    assert.equal(canCaptureClip({ isListening: true, isSaving: false, isTestingMic: false }), true)
  })
})
