import {
  formatDecodeException,
  inspectAudioContainer,
  saveDebugCaptureBlob,
} from './clipDebug'
import { logClipPipeline, logClipPipelineError, summarizeBlob } from './clipPipelineLog'

export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const container = await inspectAudioContainer(blob)
  const arrayBuffer = await blob.arrayBuffer()

  logClipPipeline('decode:input', {
    blob: summarizeBlob(blob),
    arrayBufferBytes: arrayBuffer.byteLength,
    container,
  })

  if (arrayBuffer.byteLength === 0) {
    throw new Error('Blob arrayBuffer is empty')
  }

  if (!container.likelyValidContainer) {
    logClipPipeline('decode:invalidContainer', { container })
  }

  const audioContext = new AudioContext()
  logClipPipeline('decode:attempt', {
    audioContextState: audioContext.state,
    sampleRate: audioContext.sampleRate,
  })

  try {
    const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
    logClipPipeline('decode:success', {
      durationSec: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
    })
    return buffer
  } catch (error) {
    const exception = formatDecodeException(error)
    logClipPipelineError('decode:failed', error, {
      blob: summarizeBlob(blob),
      arrayBufferBytes: arrayBuffer.byteLength,
      container,
      decodeAudioDataException: exception,
    })
    await saveDebugCaptureBlob(blob, blob.type)
    throw error
  } finally {
    void audioContext.close()
  }
}

export function computeWaveformPeaks(
  buffer: AudioBuffer,
  barCount: number,
): number[] {
  const channel = buffer.getChannelData(0)
  const samplesPerBar = Math.max(1, Math.floor(channel.length / barCount))
  const peaks: number[] = []

  for (let i = 0; i < barCount; i++) {
    let peak = 0
    let sumSquares = 0
    let samples = 0
    const start = i * samplesPerBar
    const end = Math.min(start + samplesPerBar, channel.length)

    for (let j = start; j < end; j++) {
      const sample = Math.abs(channel[j])
      peak = Math.max(peak, sample)
      sumSquares += sample * sample
      samples += 1
    }

    const rms = samples > 0 ? Math.sqrt(sumSquares / samples) : 0
    // Blend peak + RMS so quiet speech stays visible without washing out loud hits.
    peaks.push(peak * 0.7 + rms * 0.3)
  }

  return peaks
}

/** Soft threshold used by the trim canvas to separate silence from audible audio. */
export function estimateSilenceFloor(peaks: number[]): number {
  if (!peaks || peaks.length === 0) return 0.02
  const sorted = [...peaks].sort((a, b) => a - b)
  const percentile = sorted[Math.floor(sorted.length * 0.2)] ?? 0
  const max = sorted[sorted.length - 1] ?? 0
  return Math.max(0.015, Math.min(max * 0.12, percentile * 1.8 || 0.02))
}

export function peaksToDurationMs(buffer: AudioBuffer): number {
  return Math.round((buffer.length / buffer.sampleRate) * 1000)
}
