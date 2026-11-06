/**
 * Prepare a recording for Qwen without exposing microphone or file paths to the server.
 * Accepts 0.8–7 second clips. Longer recordings should be trimmed in SlipUpClipz first.
 */
import { referenceSecondsAllowed, referenceWavFrameCount } from '@shared/aiReference'

export async function audioClipToWav(blob: Blob): Promise<Uint8Array> {
  const context = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer())
  } finally {
    await context.close()
  }

  const seconds = decoded.duration
  if (!referenceSecondsAllowed(seconds)) {
    throw new Error('Select a clip between 0.8 and 7 seconds. Use Trim to shorten longer clips.')
  }

  // Resample and downmix to mono. Every accepted sample is kept; nothing is trimmed here.
  const sampleRate = 24_000
  const frames = referenceWavFrameCount(seconds)
  const offline = new OfflineAudioContext(1, frames, sampleRate)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  const samples = rendered.getChannelData(0)

  const output = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(output)
  function str(offset: number, value: string) {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  str(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM header length
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  str(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true)
  }
  return new Uint8Array(output)
}

/** Decode a clip for inspection. Does not trim, filter, or change the saved recording. */
export async function decodeClipPcm(
  blob: Blob,
): Promise<{ samples: Float32Array; sampleRate: number; durationSec: number } | null> {
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer())
    const frames = decoded.length
    const offline = new OfflineAudioContext(1, Math.max(1, frames), decoded.sampleRate)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    const rendered = await offline.startRendering()
    return {
      samples: new Float32Array(rendered.getChannelData(0)),
      sampleRate: rendered.sampleRate,
      durationSec: decoded.duration,
    }
  } catch {
    return null
  } finally {
    await context.close()
  }
}
