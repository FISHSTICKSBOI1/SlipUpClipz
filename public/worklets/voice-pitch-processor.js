/**
 * Real-time pitch shifter that preserves speech duration (no playbackRate).
 *
 * Dual-read-head WSOLA-style resampler with:
 *  - Cubic Hermite interpolation (cleaner than linear)
 *  - Hann crossfade between read heads
 *  - Soft relocate with short crossfade (reduces boundary clicks)
 *  - Smoothed pitchRatio (reduces zipper noise on preset changes)
 *
 * Observed latency ≈ delay samples / sampleRate (~70–93 ms depending on rate).
 */
class VoicePitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.bufferSize = 32768
    this.buffer = new Float32Array(this.bufferSize)
    this.writePos = 0
    // ~70 ms at 44.1 kHz — balance quality vs live-chat latency
    this.delay = 3072
    this.readA = 0
    this.readB = this.delay / 2
    this.smoothRatio = 1
    this.xfadePhase = 0
    this.relocateFade = 0
    this.relocateFromA = 0
    this.relocateFromB = 0
    this.relocateSamples = 96
  }

  static get parameterDescriptors() {
    return [
      {
        name: 'pitchRatio',
        defaultValue: 1,
        minValue: 0.5,
        maxValue: 2,
        automationRate: 'k-rate',
      },
      {
        name: 'enabled',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
    ]
  }

  wrap(position) {
    const size = this.bufferSize
    let value = position % size
    if (value < 0) value += size
    return value
  }

  distanceBehind(readPos, writePos) {
    let behind = writePos - readPos
    while (behind < 0) behind += this.bufferSize
    while (behind >= this.bufferSize) behind -= this.bufferSize
    return behind
  }

  /** Cubic Hermite interpolation — smoother speech than linear. */
  readInterpolated(position) {
    const wrapped = this.wrap(position)
    const i1 = wrapped | 0
    const i0 = (i1 - 1 + this.bufferSize) % this.bufferSize
    const i2 = (i1 + 1) % this.bufferSize
    const i3 = (i1 + 2) % this.bufferSize
    const t = wrapped - i1
    const y0 = this.buffer[i0]
    const y1 = this.buffer[i1]
    const y2 = this.buffer[i2]
    const y3 = this.buffer[i3]
    const a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3
    const a1 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3
    const a2 = -0.5 * y0 + 0.5 * y2
    const a3 = y1
    return ((a0 * t + a1) * t + a2) * t + a3
  }

  relocateReader(idealDelay) {
    return this.wrap(this.writePos - idealDelay)
  }

  maintainReader(readPos, idealDelay) {
    const behind = this.distanceBehind(readPos, this.writePos)
    const minBehind = idealDelay * 0.4
    const maxBehind = idealDelay * 1.6
    if (behind < minBehind || behind > maxBehind) {
      return { pos: this.relocateReader(idealDelay), relocated: true }
    }
    return { pos: this.wrap(readPos), relocated: false }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || !input[0] || !output || !output[0]) {
      return true
    }

    const inputChannel = input[0]
    const frameCount = inputChannel.length
    const channelCount = Math.min(input.length, output.length)

    const targetRatio = Math.max(
      0.5,
      Math.min(2, parameters.pitchRatio[0] ?? this.smoothRatio),
    )
    const enabled = (parameters.enabled[0] ?? 0) > 0.5

    // ~12–20 ms smoothing feel when dragging the pitch slider / switching presets
    this.smoothRatio += (targetRatio - this.smoothRatio) * 0.04
    const ratio = this.smoothRatio

    for (let i = 0; i < frameCount; i += 1) {
      this.buffer[this.writePos] = inputChannel[i]

      if (!enabled || Math.abs(ratio - 1) < 0.003) {
        for (let channel = 0; channel < channelCount; channel += 1) {
          output[channel][i] = inputChannel[i]
        }
        this.readA = this.relocateReader(this.delay)
        this.readB = this.relocateReader(this.delay + this.delay / 2)
        this.xfadePhase = 0
        this.relocateFade = 0
        this.writePos = (this.writePos + 1) % this.bufferSize
        continue
      }

      this.readA += ratio
      this.readB += ratio

      const maintainedA = this.maintainReader(this.readA, this.delay)
      const maintainedB = this.maintainReader(this.readB, this.delay + this.delay / 2)

      if (maintainedA.relocated || maintainedB.relocated) {
        this.relocateFromA = this.readA
        this.relocateFromB = this.readB
        this.relocateFade = this.relocateSamples
        this.readA = maintainedA.pos
        this.readB = maintainedB.pos
      } else {
        this.readA = maintainedA.pos
        this.readB = maintainedB.pos
      }

      this.xfadePhase += 1 / this.delay
      if (this.xfadePhase >= 1) this.xfadePhase -= 1

      const phaseA = this.xfadePhase
      const phaseB = (this.xfadePhase + 0.5) % 1
      const windowA = 0.5 - 0.5 * Math.cos(2 * Math.PI * phaseA)
      const windowB = 0.5 - 0.5 * Math.cos(2 * Math.PI * phaseB)
      let sampleA = this.readInterpolated(this.readA)
      let sampleB = this.readInterpolated(this.readB)

      if (this.relocateFade > 0) {
        const t = 1 - this.relocateFade / this.relocateSamples
        const fade = t * t * (3 - 2 * t)
        const oldA = this.readInterpolated(this.relocateFromA)
        const oldB = this.readInterpolated(this.relocateFromB)
        sampleA = oldA * (1 - fade) + sampleA * fade
        sampleB = oldB * (1 - fade) + sampleB * fade
        this.relocateFromA += ratio
        this.relocateFromB += ratio
        this.relocateFade -= 1
      }

      const mixed =
        (sampleA * windowA + sampleB * windowB) / (windowA + windowB + 1e-6)

      // Soft knee limit — preserve dynamics better than hard tanh drive
      const limited = Math.tanh(mixed * 1.05)

      for (let channel = 0; channel < channelCount; channel += 1) {
        // Prefer mono-derived pitch; duplicate to other channels for sync.
        output[channel][i] = limited
      }

      this.writePos = (this.writePos + 1) % this.bufferSize
    }

    return true
  }
}

registerProcessor('voice-pitch-processor', VoicePitchProcessor)
