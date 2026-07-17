import { useEffect, useState } from 'react'
import { useAppSettings } from '../../context/AppSettingsContext'
import { getVoiceEffectsRuntimeStatus } from '../../lib/soundboardAudio'
import { playToggleOffSound, playToggleOnSound, playToggleSound } from '../../lib/uiSounds'
import {
  VOICE_BASS_MAX,
  VOICE_BASS_MIN,
  VOICE_EFFECT_PRESETS,
  VOICE_PITCH_MAX,
  VOICE_PITCH_MIN,
  clampVoiceBass,
  clampVoicePitch,
  formatSemitones,
  matchVoicePreset,
  voiceEffectsStatusLabel,
  type VoiceEffectsPreset,
} from '../../lib/voiceEffects'

const PRESET_ORDER: Array<Exclude<VoiceEffectsPreset, 'custom'>> = [
  'normal',
  'deep',
  'squeaky',
  'radio',
  'robot',
]

export function VoiceEffectsControls() {
  const { settings, updateSettings } = useAppSettings()
  const [runtimeMessage, setRuntimeMessage] = useState<string | null>(null)

  useEffect(() => {
    const timers = [0, 500, 1500].map((ms) =>
      window.setTimeout(() => {
        setRuntimeMessage(getVoiceEffectsRuntimeStatus().message)
      }, ms),
    )
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [
    settings.voiceEffectsEnabled,
    settings.voicePreset,
    settings.voicePitch,
    settings.mixerMicrophoneEnabled,
  ])

  const status = voiceEffectsStatusLabel({
    enabled: settings.voiceEffectsEnabled,
    pitch: settings.voicePitch,
    bass: settings.voiceBass,
    formant: settings.voiceFormant,
    mix: settings.voiceEffectMix,
    outputGain: settings.voiceOutputGain,
    preset: settings.voicePreset,
  })

  async function setEnabled(enabled: boolean) {
    playToggleSound(enabled)
    await updateSettings({ voiceEffectsEnabled: enabled })
  }

  async function setPitch(raw: number) {
    const pitch = clampVoicePitch(raw)
    const preset = matchVoicePreset(
      pitch,
      settings.voiceBass,
      settings.voiceFormant,
      settings.voiceEffectMix,
      settings.voiceOutputGain,
    )
    await updateSettings({ voicePitch: pitch, voicePreset: preset })
  }

  async function setBass(raw: number) {
    const bass = clampVoiceBass(raw)
    const preset = matchVoicePreset(
      settings.voicePitch,
      bass,
      settings.voiceFormant,
      settings.voiceEffectMix,
      settings.voiceOutputGain,
    )
    await updateSettings({ voiceBass: bass, voicePreset: preset })
  }

  async function applyPreset(preset: Exclude<VoiceEffectsPreset, 'custom'>) {
    const values = VOICE_EFFECT_PRESETS[preset]
    // Preset engagement becomes / stays active — one ON sound, never ON+OFF together.
    playToggleOnSound()
    await updateSettings({
      voiceEffectsEnabled: true,
      voicePitch: values.pitch,
      voiceBass: values.bass,
      voiceFormant: values.formant,
      voiceEffectMix: values.mix,
      voiceOutputGain: values.outputGain,
      voicePreset: preset,
    })
  }

  async function resetEffects() {
    playToggleOffSound()
    await updateSettings({
      voiceEffectsEnabled: false,
      voicePitch: 0,
      voiceBass: 0,
      voiceFormant: 0,
      voiceEffectMix: 100,
      voiceOutputGain: 0,
      voicePreset: 'normal',
    })
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 bg-gradient-to-r from-accent-blue/10 to-accent/10 px-5 py-4 sm:px-6">
        <div>
          <h3 className="section-title">Voice Effects</h3>
          <p className="section-desc">
            Shape live mic tone before it hits virtual output and Hear Myself.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.voiceEffectsEnabled}
          aria-label="Enable Voice Effects"
          onClick={() => void setEnabled(!settings.voiceEffectsEnabled)}
          className={`toggle-track ${settings.voiceEffectsEnabled ? 'bg-accent' : 'bg-surface-border'}`}
        >
          <span
            className={`toggle-thumb ${
              settings.voiceEffectsEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <p className="badge-accent w-fit">{status}</p>
        {runtimeMessage && (
          <p className="text-xs text-amber-300/90" role="status">
            {runtimeMessage}
          </p>
        )}

        <div className={`space-y-4 ${settings.voiceEffectsEnabled ? '' : 'opacity-45'}`}>
          <EffectSlider
            label="Pitch"
            hint="Semitones · lower is deeper, higher is squeakier"
            value={settings.voicePitch}
            min={VOICE_PITCH_MIN}
            max={VOICE_PITCH_MAX}
            disabled={!settings.voiceEffectsEnabled}
            format={formatSemitones}
            onChange={(value) => void setPitch(value)}
          />

          <EffectSlider
            label="Bass"
            hint="Lower reduces body, higher boosts low end"
            value={settings.voiceBass}
            min={VOICE_BASS_MIN}
            max={VOICE_BASS_MAX}
            disabled={!settings.voiceEffectsEnabled}
            format={(value) => `${value > 0 ? '+' : ''}${value}`}
            onChange={(value) => void setBass(value)}
          />

          <div>
            <p className="control-label mb-2">Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_ORDER.map((preset) => {
                const active = settings.voiceEffectsEnabled && settings.voicePreset === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={!settings.voiceEffectsEnabled && preset === 'normal'}
                    onClick={() => void applyPreset(preset)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-accent bg-accent/25 text-white shadow-glow'
                        : 'border-white/10 bg-white/5 text-ink-soft hover:border-accent/40 hover:text-white'
                    }`}
                  >
                    {VOICE_EFFECT_PRESETS[preset].label}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => void resetEffects()}
                className="btn-ghost !px-3 !py-2 !text-xs"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EffectSlider({
  label,
  hint,
  value,
  min,
  max,
  disabled,
  format,
  onChange,
}: {
  label: string
  hint: string
  value: number
  min: number
  max: number
  disabled: boolean
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="mt-0.5 block helper-text">{hint}</span>
        </div>
        <span className="shrink-0 tabular-nums text-sm font-semibold text-accent-hover">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-accent disabled:cursor-not-allowed"
      />
    </div>
  )
}
