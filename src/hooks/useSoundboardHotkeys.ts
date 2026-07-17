import { useEffect, useMemo } from 'react'
import type { Clip } from '../types/clip'
import { formatHotkey, hotkeyToAccelerator, shouldIgnoreGlobalHotkey } from '../lib/hotkey'
import { isElectronApp } from '../lib/electronBridge'

export function useSoundboardHotkeys(
  clips: Clip[],
  playClipSoundboard: (clipId: string) => void | Promise<boolean>,
  options: {
    enabled: boolean
    useSystemGlobalHotkeys: boolean
  },
) {
  const hotkeyMap = useMemo(() => {
    const map = new Map<string, string>()

    for (const clip of clips) {
      if (!clip.hotkey || !clip.hasAudio || clip.isDraft) continue
      map.set(clip.hotkey, clip.id)
    }

    return map
  }, [clips])

  const bindings = useMemo(
    () =>
      [...hotkeyMap.entries()].map(([hotkey, clipId]) => ({
        clipId,
        accelerator: hotkeyToAccelerator(hotkey),
      })),
    [hotkeyMap],
  )

  useEffect(() => {
    if (!options.enabled || !options.useSystemGlobalHotkeys) {
      if (isElectronApp() && window.electronAPI?.hotkeys) {
        void window.electronAPI.hotkeys.sync([])
      }
      return
    }

    if (isElectronApp() && window.electronAPI?.hotkeys) {
      void window.electronAPI.hotkeys.sync(bindings)
      return
    }
  }, [bindings, options.enabled, options.useSystemGlobalHotkeys])

  useEffect(() => {
    if (!options.enabled) return

    const useWindowFallback =
      !options.useSystemGlobalHotkeys || !isElectronApp() || !window.electronAPI?.hotkeys

    if (!useWindowFallback) return

    function onKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreGlobalHotkey(event)) return

      const clipId = hotkeyMap.get(formatHotkey(event))
      if (!clipId) return

      event.preventDefault()
      void playClipSoundboard(clipId)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hotkeyMap, options.enabled, options.useSystemGlobalHotkeys, playClipSoundboard])
}

export function useElectronHotkeyTrigger(
  playClipSoundboard: (clipId: string) => void | Promise<boolean>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || !window.electronAPI?.onHotkeyTrigger) return

    return window.electronAPI.onHotkeyTrigger((clipId) => {
      void playClipSoundboard(clipId)
    })
  }, [enabled, playClipSoundboard])
}
