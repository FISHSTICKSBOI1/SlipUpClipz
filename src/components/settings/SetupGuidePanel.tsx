import { useEffect, useState } from 'react'
import {
  RECORDING_VERSUS_ROUTING,
  VOICE_CHAT_TROUBLESHOOTING,
  captureGoalPlan,
  captureGoalSettingsPatch,
  recommendSetup,
  type CaptureGoal,
} from '@shared/setupGuide'
import { useAppSettings } from '../../context/AppSettingsContext'
import type { AudioInputDevice } from '../../lib/audioDevices'
import { useAudioOutputDevices } from '../../hooks/useAudioOutputDevices'

async function listInputsWithoutOpeningMicrophone(): Promise<AudioInputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((device) => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default')
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label,
    }))
    .filter((device) => device.label.length > 0)
}

const GOALS: Array<{ id: CaptureGoal; label: string }> = [
  { id: 'teammates', label: 'Record what I hear' },
  { id: 'myself', label: 'Record my microphone' },
  { id: 'both', label: 'Record myself and what I hear' },
]

export function SetupGuidePanel() {
  const { settings, updateSettings } = useAppSettings()
  const { devices } = useAudioOutputDevices()
  const [inputs, setInputs] = useState<AudioInputDevice[]>([])
  const [goal, setGoal] = useState<CaptureGoal | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listInputsWithoutOpeningMicrophone().then((next) => {
      if (!cancelled) setInputs(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const headphone = devices.find((device) => device.deviceId === settings.audioOutputDeviceId)
  const recommendation = recommendSetup(inputs, devices, headphone?.label ?? null)
  const selected = goal ? captureGoalPlan(goal) : null

  function choose(next: CaptureGoal) {
    setGoal(next)
    const plan = captureGoalPlan(next)
    const patch = captureGoalSettingsPatch(next)
    if (patch) void updateSettings(patch)
    setMessage(plan.summary)
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
      <div>
        <p className="text-sm font-medium text-white">Setup guide</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Choose what Clip should save. This does not change Gaming + Discord, your headphones, or
          the microphone Discord uses.
        </p>
      </div>

      <div className="space-y-2">
        {GOALS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => choose(entry.id)}
            className={`block w-full rounded-lg border px-3 py-2 text-left text-xs ${
              goal === entry.id
                ? 'border-accent bg-accent/15 text-white'
                : 'border-white/10 text-white hover:border-accent/40'
            }`}
          >
            {entry.label}
            {!captureGoalPlan(entry.id).supported ? ' — not available yet' : ''}
          </button>
        ))}
        {message && <p className="text-xs leading-relaxed text-ink-muted">{message}</p>}
        {selected && !selected.supported && (
          <p className="text-xs leading-relaxed text-amber-200">
            A later update could mix the microphone you already chose into the “what I hear”
            recording. That needs a change to the replay buffer, so it is not turned on here.
          </p>
        )}
      </div>

      <ul className="space-y-1.5 text-xs leading-relaxed text-ink-muted">
        {RECORDING_VERSUS_ROUTING.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <div className="text-xs leading-relaxed text-ink-muted">
        <p>
          Microphones found:{' '}
          {recommendation.physicalMics.length
            ? recommendation.physicalMics.map((device) => device.label).join(', ')
            : 'none with a visible name yet. This guide does not turn the microphone on.'}
          .
        </p>
        {recommendation.processedExplanation ? (
          <p className="mt-2">{recommendation.processedExplanation}</p>
        ) : (
          <p className="mt-2">No processed microphone was found, so no noise-processor steps are shown.</p>
        )}
        <p className="mt-2">
          {recommendation.cableInput
            ? `${recommendation.cableInput.label} is where SlipUpClipz can send soundboard audio. Discord and games should listen to CABLE Output, not CABLE Input.`
            : 'A virtual cable is needed only when teammates should hear soundboard clips. Install VB-Audio Virtual Cable, then use CABLE Input inside SlipUpClipz and CABLE Output in Discord or the game.'}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-white">If teammates should hear soundboard clips</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-ink-muted">
          {recommendation.manualSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="space-y-2">
        {VOICE_CHAT_TROUBLESHOOTING.map((item) => (
          <p key={item.problem} className="text-xs leading-relaxed text-ink-muted">
            <span className="text-white">{item.problem}. </span>
            {item.fix}
          </p>
        ))}
      </div>
    </div>
  )
}
