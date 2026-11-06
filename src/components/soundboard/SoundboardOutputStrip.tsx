import { useEffect, useState } from 'react'
import {
  buildAudioRoutePlan,
  headphoneMonitorMessage,
  headphonesCanMonitor,
  HEAR_MYSELF_HEADPHONE_ERROR,
  isDisallowedHeadphoneLabel,
  isMicrophoneMonitoring,
  pickCableInput,
  prepareGamingDiscordPreset,
} from '@shared/gamingAudioRouting'
import { useAppSettings } from '../../context/AppSettingsContext'
import { formatOutputDeviceOptionLabel, listAudioInputDevices, type AudioInputDevice } from '../../lib/audioDevices'
import { useAudioOutputDevices } from '../../hooks/useAudioOutputDevices'
import { playToggleSound } from '../../lib/uiSounds'

export function SoundboardOutputStrip() {
  const { settings, updateSettings, outputRoutingNotice } = useAppSettings()
  const { devices, isLoading } = useAudioOutputDevices()
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

  const cable = pickCableInput(devices)
  const plan = buildAudioRoutePlan(settings, devices, inputs).plan
  const monitoring = isMicrophoneMonitoring(plan, settings)
  const selected = devices.find((device) => device.deviceId === settings.audioOutputDeviceId)
  const outputValue = (settings.routeToVBCable || settings.gamingDiscordPreset) && cable
    ? 'vb-cable'
    : (settings.audioOutputDeviceId ?? 'default')

  async function changeOutput(next: string) {
    setError(null)
    if (next === 'vb-cable') {
      const micId = settings.voiceChatMicrophoneDeviceId || settings.audioInputDeviceId
      const headphone = devices.find((device) => device.deviceId === settings.audioOutputDeviceId)
      const prepared = settings.mixerMicrophoneEnabled && micId
        ? prepareGamingDiscordPreset({
          outputs: devices,
          inputs,
          headphoneDeviceId: headphone && !isDisallowedHeadphoneLabel(headphone.label) ? headphone.deviceId : null,
          useAsusInput: false,
          selectedMicrophoneId: micId,
        })
        : null
      if (prepared?.ok) {
        await updateSettings({
          routeToVBCable: true,
          gamingDiscordPreset: true,
          voiceChatMicrophoneDeviceId: prepared.microphoneDeviceId,
          audioOutputDeviceId: prepared.headphone.deviceId,
        })
        return
      }
      await updateSettings({ routeToVBCable: true })
      return
    }
    await updateSettings({
      audioOutputDeviceId: next === 'default' ? null : next,
      ...(settings.gamingDiscordPreset ? {} : { routeToVBCable: false }),
    })
  }

  async function toggleHearMyself() {
    setError(null)
    if (monitoring) {
      playToggleSound(false)
      await updateSettings({ monitorMicrophoneLocally: false })
      return
    }
    const monitorMessage = headphoneMonitorMessage({
      selectedId: settings.audioOutputDeviceId,
      selectedLabel: selected?.label ?? null,
    })
    if (monitorMessage) {
      setError(monitorMessage)
      return
    }
    playToggleSound(true)
    await updateSettings({ monitorMicrophoneLocally: true })
  }

  return (
    <div className="space-y-3">
      <div className="control-strip">
        <label className="stat-chip sm:col-span-2 xl:col-span-1">
          <span className="control-label">Output</span>
          <select
            value={outputValue}
            disabled={isLoading}
            aria-label="Output"
            onChange={(event) => void changeOutput(event.target.value)}
            className="device-select mt-1 w-full bg-transparent text-sm font-medium text-white outline-none"
          >
            <option value="default">Default Speakers</option>
            {cable && <option value="vb-cable">{cable.label}</option>}
            {devices
              .filter((device) => device.deviceId !== 'default' && device.deviceId !== cable?.deviceId)
              .map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {formatOutputDeviceOptionLabel(device)}
                </option>
              ))}
          </select>
        </label>
        <div className="stat-chip flex items-center justify-between gap-3 sm:col-span-2 xl:col-span-3">
          <div>
            <p className="control-label">Hear myself</p>
            <p className="helper-text mt-1">
              Play your microphone in {selected && headphonesCanMonitor(selected.label) ? selected.label : 'your headphones'}.{' '}
              {HEAR_MYSELF_HEADPHONE_ERROR}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={monitoring}
            aria-label="Hear myself"
            onClick={() => void toggleHearMyself()}
            className={`toggle-track ${monitoring ? 'bg-accent' : 'bg-surface-border'}`}
          >
            <span className={`toggle-thumb ${monitoring ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
      {(error || outputRoutingNotice) && (
        <p className="text-xs text-amber-200">{error || outputRoutingNotice}</p>
      )}
    </div>
  )
}
