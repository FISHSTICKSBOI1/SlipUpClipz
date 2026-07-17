import { useAppSettings } from '../../context/AppSettingsContext'
import { MicrophoneIcon } from '../icons'
import { playToggleSound } from '../../lib/uiSounds'

export function SoundboardMixerControls() {
  const { settings, updateSettings } = useAppSettings()

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-white/5 bg-gradient-to-r from-accent/10 to-transparent px-5 py-4 sm:px-6">
        <h3 className="section-title">Live audio mixer</h3>
        <p className="section-desc">
          Mix microphone with soundboard pads and send the combined stream to your output — similar
          to a gaming voice utility.
        </p>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
          <label className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent-hover">
              <MicrophoneIcon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">Microphone</span>
              <span className="helper-text">
                {settings.mixerMicrophoneEnabled
                  ? 'Mic + pads mixed to output'
                  : 'Pads only — mic muted in mix'}
              </span>
            </span>
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={settings.mixerMicrophoneEnabled}
            onClick={() => {
              const nextValue = !settings.mixerMicrophoneEnabled
              playToggleSound(nextValue)
              void updateSettings({
                mixerMicrophoneEnabled: nextValue,
              })
            }}
            className={`toggle-track ${
              settings.mixerMicrophoneEnabled ? 'bg-clip' : 'bg-surface-border'
            }`}
          >
            <span
              className={`toggle-thumb ${
                settings.mixerMicrophoneEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <VolumeSlider
            label="Mic volume"
            value={settings.mixerMicrophoneVolume}
            disabled={!settings.mixerMicrophoneEnabled}
            onChange={(value) => void updateSettings({ mixerMicrophoneVolume: value })}
          />
          <VolumeSlider
            label="Soundboard volume"
            value={settings.mixerSoundboardVolume}
            onChange={(value) => void updateSettings({ mixerSoundboardVolume: value })}
          />
        </div>
      </div>
    </div>
  )
}

function VolumeSlider({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <div className={`rounded-xl border border-white/8 bg-black/20 p-3 ${disabled ? 'opacity-45' : ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="control-label">{label}</span>
        <span className="tabular-nums text-sm font-semibold text-white">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-accent disabled:cursor-not-allowed"
      />
    </div>
  )
}
