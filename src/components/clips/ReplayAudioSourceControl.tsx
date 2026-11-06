import { useEffect, useState } from 'react'
import type { ReplayAudioSource } from '@shared/appTypes'
import { inputDeviceStillPresent, microphoneChoicePatch, replayMicrophoneStatus } from '@shared/replayCapture'
import { useAppSettings } from '../../context/AppSettingsContext'
import { useReplayBufferContext } from '../../context/ReplayBufferContext'
import {
  listAudioInputDevices,
  listVirtualAudioInputDevices,
  subscribeToAudioDeviceChanges,
  type AudioInputDevice,
  type VirtualAudioInputDevice,
} from '../../lib/audioDevices'
import { isElectronApp } from '../../lib/electronBridge'
import { VB_CABLE_SETUP_MESSAGE } from '../../lib/replayAudioCapture'

export function ReplayAudioSourceControl() {
  const { settings, updateSettings } = useAppSettings()
  const { isListening, microphoneLabel, replayAudioSource } = useReplayBufferContext()
  const [virtualInputs, setVirtualInputs] = useState<VirtualAudioInputDevice[]>([])
  const [microphones, setMicrophones] = useState<AudioInputDevice[]>([])
  const [loopbackSupported, setLoopbackSupported] = useState(false)

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      void listVirtualAudioInputDevices().then((devices) => {
        if (!cancelled) setVirtualInputs(devices)
      })
      void listAudioInputDevices().then((devices) => {
        if (!cancelled) setMicrophones(devices)
      })
    }
    refresh()
    void window.electronAPI?.systemAudio
      ?.getCapabilities()
      .then((caps) => {
        if (!cancelled) setLoopbackSupported(caps.loopbackSupported)
      })
      .catch(() => {
        if (!cancelled) setLoopbackSupported(false)
      })
    const unsubscribe = subscribeToAudioDeviceChanges(refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  async function handleReplaySourceChange(source: ReplayAudioSource) {
    await updateSettings({ replayAudioSource: source })
  }

  async function handleMicrophoneChange(deviceId: string) {
    await updateSettings(microphoneChoicePatch(deviceId))
  }

  async function handleVirtualInputChange(deviceId: string) {
    await updateSettings({
      virtualAudioInputDeviceId: deviceId === 'default' ? null : deviceId,
      replayAudioSource: 'virtual',
    })
  }

  return (
    <div className="rounded-lg border border-surface-overlay bg-surface-overlay/40 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-gray-200">Replay audio source</h3>
        <p className="mt-1 text-xs text-gray-500">
          Choose what the instant replay buffer records. Active source:{' '}
          <span className="text-gray-300">
            {settings.replayAudioSource === 'microphone'
              ? 'Microphone'
              : settings.replayAudioSource === 'system'
                ? 'System audio'
                : 'Virtual audio device'}
          </span>
        </p>
      </div>

      <div className="space-y-1">
        <SourceOption
          name="clips-replay-audio-source"
          label="Microphone"
          description="Record your microphone input."
          checked={settings.replayAudioSource === 'microphone'}
          onChange={() => void handleReplaySourceChange('microphone')}
        />
        <SourceOption
          name="clips-replay-audio-source"
          label="System audio"
          description={
            loopbackSupported && isElectronApp()
              ? 'Capture what you hear via WASAPI loopback (games, Discord, system sounds).'
              : 'WASAPI loopback requires the SlipUpClipz desktop app on Windows or Linux.'
          }
          checked={settings.replayAudioSource === 'system'}
          disabled={!loopbackSupported || !isElectronApp()}
          onChange={() => void handleReplaySourceChange('system')}
        />
        <SourceOption
          name="clips-replay-audio-source"
          label="Virtual audio device"
          description="Capture from VB-Audio Cable Output, VoiceMeeter, or another virtual input."
          checked={settings.replayAudioSource === 'virtual'}
          onChange={() => void handleReplaySourceChange('virtual')}
        />
      </div>

      <MicrophoneChoice
        savedId={settings.audioInputDeviceId}
        microphones={microphones}
        source={replayAudioSource}
        listening={isListening}
        activeLabel={microphoneLabel}
        onChange={(deviceId) => void handleMicrophoneChange(deviceId)}
      />

      {settings.replayAudioSource === 'virtual' && (
        <div className="mt-3">
          <label className="text-xs font-medium text-gray-400" htmlFor="virtual-input-device">
            Virtual input device
          </label>
          <select
            id="virtual-input-device"
            value={settings.virtualAudioInputDeviceId ?? virtualInputs[0]?.deviceId ?? 'default'}
            onChange={(event) => void handleVirtualInputChange(event.target.value)}
            className="device-select mt-2 w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-gray-200 outline-none focus:border-accent"
          >
            {virtualInputs.length > 0 ? (
              virtualInputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.isVBCable
                    ? `${device.label} (VB-Cable)`
                    : device.isVoiceMeeter
                      ? `${device.label} (VoiceMeeter)`
                      : device.label}
                </option>
              ))
            ) : (
              <option value="default">No virtual devices detected</option>
            )}
          </select>
        </div>
      )}

      {settings.replayAudioSource === 'system' && (!loopbackSupported || !isElectronApp()) && (
        <p className="mt-3 text-xs text-amber-300">{VB_CABLE_SETUP_MESSAGE}</p>
      )}

      {settings.replayAudioSource === 'virtual' && virtualInputs.length === 0 && (
        <p className="mt-3 text-xs text-amber-300">{VB_CABLE_SETUP_MESSAGE}</p>
      )}
    </div>
  )
}

function MicrophoneChoice({
  savedId,
  microphones,
  source,
  listening,
  activeLabel,
  onChange,
}: {
  savedId: string | null
  microphones: AudioInputDevice[]
  source: ReplayAudioSource
  listening: boolean
  activeLabel: string | null
  onChange: (deviceId: string) => void
}) {
  const savedDevice = microphones.find((device) => device.deviceId === savedId)
  const savedPresent = !savedId || microphones.length === 0 || inputDeviceStillPresent(savedId, microphones)
  const status = replayMicrophoneStatus({
    source,
    savedPresent,
    savedLabel: savedDevice?.label ?? (savedId ? 'saved device' : 'System default'),
    listening,
    activeLabel,
  })

  return (
    <div className="mt-3">
      <label className="text-xs font-medium text-gray-400" htmlFor="microphone-input-device">
        Microphone
      </label>
      <select
        id="microphone-input-device"
        value={savedId ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="device-select mt-2 w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-gray-200 outline-none focus:border-accent"
      >
        <option value="">System default</option>
        {savedId && microphones.length > 0 && !inputDeviceStillPresent(savedId, microphones) && (
          <option value={savedId}>Saved microphone unavailable</option>
        )}
        {microphones.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-gray-500">{status.saved}</p>
      <p className="mt-1 text-xs text-gray-500">{status.active}</p>
    </div>
  )
}

function SourceOption({
  name,
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  name: string
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 py-2 ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-1 accent-accent"
      />
      <span>
        <span className="block text-sm font-medium text-gray-200">{label}</span>
        <span className="mt-0.5 block text-xs text-gray-500">{description}</span>
      </span>
    </label>
  )
}
