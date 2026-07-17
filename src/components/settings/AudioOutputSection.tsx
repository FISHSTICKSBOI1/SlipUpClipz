import { useState } from 'react'
import { useAppSettings } from '../../context/AppSettingsContext'
import { useLicense } from '../../context/LicenseContext'
import {
  getOutputDeviceLabel,
  useActiveOutputDeviceLabel,
  useAudioOutputDevices,
} from '../../hooks/useAudioOutputDevices'
import { validateOutputRouting, formatOutputDeviceOptionLabel } from '../../lib/audioDevices'
import { warmUpAudioEngine, playOutputTestTone } from '../../lib/soundboardAudio'
import { playToggleSound } from '../../lib/uiSounds'
import { PaywallNotice } from '../license/PaywallNotice'
import { SettingsSectionHeader } from './SettingsSectionHeader'
import { VirtualAudioSetupPanel } from './VirtualAudioSetupPanel'

export function AudioOutputSection() {
  const { settings, updateSettings, outputRoutingNotice, clearOutputRoutingNotice } =
    useAppSettings()
  const { isPro } = useLicense()
  const { devices, isLoading, hasVirtualOutput } = useAudioOutputDevices()
  const activeOutputLabel = useActiveOutputDeviceLabel(devices, settings)
  const validation = validateOutputRouting(devices, settings)

  const [isTestingOutput, setIsTestingOutput] = useState(false)
  const [testOutputMessage, setTestOutputMessage] = useState<string | null>(null)

  const vbCable = devices.find((device) => device.isVBCable)

  async function toggleRouteToVBCable() {
    if (!isPro) return
    const nextValue = !settings.routeToVBCable
    playToggleSound(nextValue)
    await updateSettings({ routeToVBCable: nextValue })
  }

  async function handleOutputChange(deviceId: string) {
    if (!isPro) return
    clearOutputRoutingNotice()
    await updateSettings({
      audioOutputDeviceId: deviceId === 'default' ? null : deviceId,
      routeToVBCable: false,
    })
  }

  async function handleTestOutput() {
    if (!isPro) return

    setIsTestingOutput(true)
    setTestOutputMessage(null)
    warmUpAudioEngine()

    const played = await playOutputTestTone()
    const label = activeOutputLabel

    if (played) {
      setTestOutputMessage(`Test tone sent to: ${label}`)
    } else {
      setTestOutputMessage('Could not play the test tone. Check your output device and try again.')
    }

    setIsTestingOutput(false)
  }

  return (
    <section className="panel overflow-hidden">
      <SettingsSectionHeader
        title="Output"
        description="Route soundboard playback to your speakers, headphones, or a virtual audio device for Discord and games."
      />

      <div className="divide-y divide-surface-border px-5 sm:px-6">
        {!hasVirtualOutput && !isLoading && (
          <div className="py-4">
            <VirtualAudioSetupPanel />
          </div>
        )}

        {outputRoutingNotice && (
          <p className="py-4 text-xs text-amber-300">{outputRoutingNotice}</p>
        )}

        {!isPro ? (
          <div className="py-4">
            <PaywallNotice feature="vbCableRouting" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-medium text-gray-200">Route to VB-Audio Cable</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {vbCable
                    ? `Quick route to ${vbCable.label}.`
                    : 'VB-Audio Virtual Cable was not detected on this PC.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.routeToVBCable && validation.routeToVBCableEffective}
                disabled={!vbCable}
                onClick={() => void toggleRouteToVBCable()}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  settings.routeToVBCable && validation.routeToVBCableEffective
                    ? 'bg-accent'
                    : 'bg-surface-border'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    settings.routeToVBCable && validation.routeToVBCableEffective
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="py-4">
              <p className="text-sm font-medium text-gray-200">Output device</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Choose where soundboard clips play. Soundboard audio is routed only to this device.
              </p>

              <select
                value={settings.audioOutputDeviceId ?? 'default'}
                disabled={isLoading || settings.routeToVBCable}
                onChange={(event) => void handleOutputChange(event.target.value)}
                className="mt-3 w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-gray-200 outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="default">Default Speakers</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {formatOutputDeviceOptionLabel(device)}
                  </option>
                ))}
              </select>

              {settings.routeToVBCable && validation.routeToVBCableEffective && vbCable && (
                <p className="mt-2 text-[11px] text-gray-500">
                  VB-Cable quick route is active. Output: {vbCable.label}
                </p>
              )}

              {!settings.routeToVBCable && (
                <p className="mt-2 text-[11px] text-gray-500">
                  Active output: {activeOutputLabel}
                </p>
              )}

              {validation.missingVBCable && settings.routeToVBCable && (
                <p className="mt-2 text-[11px] text-amber-300">
                  VB-Audio Virtual Cable is no longer available. Using{' '}
                  {getOutputDeviceLabel(devices, settings.audioOutputDeviceId)} instead.
                </p>
              )}
            </div>

            <div className="py-4">
              <p className="text-sm font-medium text-gray-200">Test output</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Play a short test tone through the selected output device.
              </p>

              <button
                type="button"
                onClick={() => void handleTestOutput()}
                disabled={isTestingOutput || isLoading}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isTestingOutput ? 'Playing test tone...' : 'Test Output'}
              </button>

              {testOutputMessage && (
                <p className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                  {testOutputMessage}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
