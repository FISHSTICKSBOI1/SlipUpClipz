import { useCallback, useEffect, useState } from 'react'
import {
  getOutputDeviceLabel,
  hasRecommendedVirtualOutput,
  listAudioOutputDevices,
  subscribeToAudioDeviceChanges,
  validateOutputRouting,
  type AudioOutputDevice,
} from '../lib/audioDevices'

export function useAudioOutputDevices() {
  const [devices, setDevices] = useState<AudioOutputDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    const next = await listAudioOutputDevices()
    setDevices(next)
    setIsLoading(false)
    return next
  }, [])

  useEffect(() => {
    void refresh()
    return subscribeToAudioDeviceChanges(() => {
      void refresh()
    })
  }, [refresh])

  return {
    devices,
    isLoading,
    refresh,
    hasVirtualOutput: hasRecommendedVirtualOutput(devices),
  }
}

export function useActiveOutputDeviceLabel(
  devices: AudioOutputDevice[],
  settings: {
    routeToVBCable: boolean
    audioOutputDeviceId: string | null
  },
): string {
  const validation = validateOutputRouting(devices, settings)
  return getOutputDeviceLabel(devices, validation.streamDeviceId)
}

export { getOutputDeviceLabel }
