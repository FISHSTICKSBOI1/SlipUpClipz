import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { buildAudioRoutePlan } from '@shared/gamingAudioRouting'
import {
  listAudioInputDevices,
  listAudioOutputDevices,
  subscribeToAudioDeviceChanges,
  validateOutputRouting,
} from '../lib/audioDevices'
import { loadAppSettings, saveAppSettings } from '../lib/electronBridge'
import {
  applySoundboardRoute,
  setMicrophoneInputDevice,
  setSoundboardMixerSettings,
  setVoiceEffectsSettings,
  soundboardRouteRestored,
} from '../lib/soundboardAudio'
import type { AppSettings } from '@shared/appTypes'
import { DEFAULT_SETTINGS } from '@shared/appTypes'

type AppSettingsContextValue = {
  settings: AppSettings
  isLoading: boolean
  outputRoutingNotice: string | null
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  clearOutputRoutingNotice: () => void
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null)

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [outputRoutingNotice, setOutputRoutingNotice] = useState<string | null>(null)
  const settingsRef = useRef(settings)
  const lastPlanKeyRef = useRef<string | null>(null)

  settingsRef.current = settings

  const applySoundboardAudio = useCallback(async (nextSettings: AppSettings): Promise<string | null> => {
    await setMicrophoneInputDevice(nextSettings.audioInputDeviceId)

    const [devices, inputs] = await Promise.all([listAudioOutputDevices(), listAudioInputDevices()])
    const validation = validateOutputRouting(devices, nextSettings)
    if (validation.missingVBCable && nextSettings.routeToVBCable && !nextSettings.gamingDiscordPreset) {
      setOutputRoutingNotice(
        'VB-Audio Virtual Cable is no longer available. Soundboard output is using your selected fallback device.',
      )
    }

    const built = buildAudioRoutePlan(nextSettings, devices, inputs)
    const planKey = JSON.stringify(built.plan)
    let routeError: string | null = null
    if (lastPlanKeyRef.current !== planKey) {
      routeError = await applySoundboardRoute(built.plan)
      if (!routeError) lastPlanKeyRef.current = planKey
    }
    if (built.notice) setOutputRoutingNotice(built.notice)
    if (routeError) setOutputRoutingNotice(routeError)

    await setSoundboardMixerSettings({
      microphoneEnabled: nextSettings.gamingDiscordPreset ? true : nextSettings.mixerMicrophoneEnabled,
      microphoneVolume: nextSettings.mixerMicrophoneVolume,
      soundboardVolume: nextSettings.mixerSoundboardVolume,
    })

    await setVoiceEffectsSettings({
      enabled: nextSettings.gamingDiscordPreset ? false : nextSettings.voiceEffectsEnabled,
      pitch: nextSettings.voicePitch,
      bass: nextSettings.voiceBass,
      formant: nextSettings.voiceFormant,
      mix: nextSettings.voiceEffectMix,
      outputGain: nextSettings.voiceOutputGain,
      preset: nextSettings.voicePreset,
    })
    return routeError
  }, [])

  const repairOutputRouting = useCallback(
    async (currentSettings: AppSettings, notify: boolean): Promise<AppSettings> => {
      const devices = await listAudioOutputDevices()
      const validation = validateOutputRouting(devices, currentSettings)
      const patch: Partial<AppSettings> = {}
      const notices: string[] = []

      if (!validation.storedDeviceValid && currentSettings.audioOutputDeviceId) {
        patch.audioOutputDeviceId = null
        notices.push(
          'Your previously selected output device is no longer available. Switched to the system default.',
        )
      }

      if (validation.missingVBCable && currentSettings.routeToVBCable) {
        notices.push(
          'VB-Audio Virtual Cable is no longer available. Soundboard output is using your selected fallback device.',
        )
      }

      let nextSettings = currentSettings
      if (Object.keys(patch).length > 0) {
        nextSettings = await saveAppSettings(patch)
      }

      if (notify && notices.length > 0) {
        setOutputRoutingNotice(notices.join(' '))
      }

      return nextSettings
    },
    [],
  )

  useEffect(() => {
    void (async () => {
      const loaded = await loadAppSettings()
      const repaired = await repairOutputRouting(loaded, false)
      setSettings(repaired)
      setIsLoading(false)
      lastPlanKeyRef.current = null
      await applySoundboardAudio(repaired)
    })()
  }, [applySoundboardAudio, repairOutputRouting])

  useEffect(() => {
    if (isLoading) return

    return subscribeToAudioDeviceChanges(() => {
      void (async () => {
        const repaired = await repairOutputRouting(settingsRef.current, true)
        setSettings(repaired)
        lastPlanKeyRef.current = null
        await applySoundboardAudio(repaired)
      })()
    })
  }, [applySoundboardAudio, isLoading, repairOutputRouting])

  async function updateSettings(partial: Partial<AppSettings>) {
    const previous = settingsRef.current
    clearOutputRoutingNotice()
    const next = await saveAppSettings(partial)
    setSettings(next)
    const error = await applySoundboardAudio(next)
    if (!error) return

    const undo: Partial<AppSettings> = {}
    for (const key of Object.keys(partial) as Array<keyof AppSettings>) {
      undo[key] = previous[key] as never
    }
    const restored = await saveAppSettings(undo)
    setSettings(restored)
    if (!soundboardRouteRestored()) lastPlanKeyRef.current = null
    await applySoundboardAudio(restored)
    setOutputRoutingNotice(error)
  }

  function clearOutputRoutingNotice() {
    setOutputRoutingNotice(null)
  }

  return (
    <AppSettingsContext.Provider
      value={{
        settings,
        isLoading,
        outputRoutingNotice,
        updateSettings,
        clearOutputRoutingNotice,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext)
  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider')
  }
  return context
}
