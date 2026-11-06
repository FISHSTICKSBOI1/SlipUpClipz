import { useEffect, useState } from 'react'
import {
  buildAudioRoutePlan,
  isDisallowedHeadphoneLabel,
  isMicrophoneSentToCable,
  pickCableInput,
  prepareGamingDiscordPreset,
} from '@shared/gamingAudioRouting'
import { useAppSettings } from '../../context/AppSettingsContext'
import { listAudioInputDevices, type AudioInputDevice } from '../../lib/audioDevices'
import { useAudioOutputDevices } from '../../hooks/useAudioOutputDevices'
import { playToggleSound } from '../../lib/uiSounds'
import { MicrophoneIcon } from '../icons'

export function SoundboardMixerControls() {
  const { settings, updateSettings } = useAppSettings()
  const { devices } = useAudioOutputDevices()
  const [inputs, setInputs] = useState<AudioInputDevice[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listAudioInputDevices().then((next) => {
      if (!cancelled) setInputs(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const plan = buildAudioRoutePlan(settings, devices, inputs).plan
  const sending = settings.gamingDiscordPreset && isMicrophoneSentToCable(plan, devices)
  const micOn = settings.gamingDiscordPreset || settings.mixerMicrophoneEnabled

  async function turnOff() {
    setError(null)
    playToggleSound(false)
    await updateSettings({
      gamingDiscordPreset: false,
      mixerMicrophoneEnabled: false,
    })
  }

  async function turnOn() {
    setError(null)
    const cable = pickCableInput(devices)
    const outputIsCable = Boolean(cable && settings.audioOutputDeviceId === cable.deviceId)
    const useVoiceRoute = Boolean(cable && (settings.routeToVBCable || outputIsCable || settings.gamingDiscordPreset))
    if (!useVoiceRoute) {
      playToggleSound(true)
      await updateSettings({ mixerMicrophoneEnabled: true })
      return
    }
    const micId = settings.voiceChatMicrophoneDeviceId || settings.audioInputDeviceId
    if (!micId) {
      setError('Choose a microphone on the Clips page before it can join the mix.')
      return
    }
    const headphoneId = settings.audioOutputDeviceId
    const headphone = devices.find((device) => device.deviceId === headphoneId)
    const prepared = prepareGamingDiscordPreset({
      outputs: devices,
      inputs,
      headphoneDeviceId: headphone && !isDisallowedHeadphoneLabel(headphone.label) ? headphone.deviceId : null,
      useAsusInput: false,
      selectedMicrophoneId: micId,
    })
    if (!prepared.ok) {
      playToggleSound(true)
      await updateSettings({ mixerMicrophoneEnabled: true })
      setError(prepared.message)
      return
    }
    playToggleSound(true)
    await updateSettings({
      gamingDiscordPreset: true,
      voiceChatMicrophoneDeviceId: prepared.microphoneDeviceId,
      audioOutputDeviceId: prepared.headphone.deviceId,
    })
  }

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
                {settings.gamingDiscordPreset && !sending
                  ? 'Voice chat output is not available. Nothing was switched.'
                  : sending
                    ? 'Microphone is going to voice chat'
                    : micOn
                      ? 'Mic + pads mixed to output'
                      : 'Pads only — mic muted in mix'}
              </span>
            </span>
          </label>
          <div className="flex items-center gap-3">
            {settings.gamingDiscordPreset && (
              <button type="button" onClick={() => void turnOff()} className="text-xs font-semibold text-white underline">
                Stop
              </button>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={micOn}
              aria-label="Microphone"
              onClick={() => void (micOn ? turnOff() : turnOn())}
              className={`toggle-track ${micOn ? 'bg-clip' : 'bg-surface-border'}`}
            >
              <span className={`toggle-thumb ${micOn ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-amber-200">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <VolumeSlider
            label="Mic volume"
            value={settings.mixerMicrophoneVolume}
            disabled={!micOn}
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
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-accent disabled:cursor-not-allowed"
      />
    </div>
  )
}
