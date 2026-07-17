import type { RecordingResult } from '../types/clip'
import { logClipPipeline, summarizeBlob } from './clipPipelineLog'

const TRIMMED_MIME_TYPE = 'audio/wav'

export function sliceAudioBuffer(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): AudioBuffer {
  const sampleRate = buffer.sampleRate
  const startSample = Math.max(0, Math.floor(startSec * sampleRate))
  const endSample = Math.min(buffer.length, Math.ceil(endSec * sampleRate))
  const length = Math.max(1, endSample - startSample)

  const trimmed = new AudioBuffer({
    length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate,
  })

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel)
    const target = trimmed.getChannelData(channel)
    target.set(source.subarray(startSample, endSample))
  }

  return trimmed
}

function encodeWav(buffer: AudioBuffer): Blob {
  const channelCount = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = channelCount * bytesPerSample
  const dataLength = buffer.length * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = buffer.getChannelData(channel)[i]
      const clamped = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
      offset += bytesPerSample
    }
  }

  return new Blob([arrayBuffer], { type: TRIMMED_MIME_TYPE })
}

export function trimAudioBuffer(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): RecordingResult {
  const trimmed = sliceAudioBuffer(buffer, startSec, endSec)
  const blob = encodeWav(trimmed)
  const durationMs = Math.round((trimmed.length / trimmed.sampleRate) * 1000)

  logClipPipeline('trim:encoded', {
    mimeType: TRIMMED_MIME_TYPE,
    blob: summarizeBlob(blob),
    durationMs,
    startSec,
    endSec,
  })

  return {
    blob,
    mimeType: TRIMMED_MIME_TYPE,
    durationMs,
  }
}
