import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Clip } from '../types/clip'
import {
  loadSoundboardState,
  saveSoundboardState,
  PAD_VOLUME_DEFAULT,
  SOUNDBOARD_SLOT_COUNT,
  type SoundboardPad,
  type SoundboardState,
} from '../lib/soundboardStorage'
import { FREE_SOUNDBOARD_PAD_LIMIT } from '@shared/appTypes'

export function useSoundboard(clips: Clip[], maxPads = SOUNDBOARD_SLOT_COUNT) {
  const [state, setState] = useState<SoundboardState>(() => loadSoundboardState())
  const [flashingSlots, setFlashingSlots] = useState<Set<number>>(() => new Set())

  const pads = state.pads

  const playableClips = useMemo(
    () => clips.filter((clip) => clip.hasAudio && !clip.isDraft),
    [clips],
  )

  const clipById = useMemo(
    () => new Map(playableClips.map((clip) => [clip.id, clip])),
    [playableClips],
  )

  useEffect(() => {
    saveSoundboardState(state)
  }, [state])

  useEffect(() => {
    setState((prev) => {
      let changed = false
      const nextPads = prev.pads.map((pad) => {
        if (pad.clipId && !clipById.has(pad.clipId)) {
          changed = true
          return { ...pad, clipId: null }
        }
        return pad
      })
      return changed ? { ...prev, pads: nextPads } : prev
    })
  }, [clipById])

  const updatePads = useCallback((updater: (pads: SoundboardPad[]) => SoundboardPad[]) => {
    setState((prev) => ({ ...prev, pads: updater(prev.pads) }))
  }, [])

  const assignClipToSlot = useCallback(
    (slotIndex: number, clipId: string) => {
      if (slotIndex < 0 || slotIndex >= maxPads) return
      if (!clipById.has(clipId)) return

      updatePads((prev) => {
        const next = prev.map((pad) => ({ ...pad }))
        const existingIndex = next.findIndex((pad) => pad.clipId === clipId)
        if (existingIndex !== -1 && existingIndex !== slotIndex) {
          next[existingIndex] = { ...next[existingIndex], clipId: null }
        }
        next[slotIndex] = {
          clipId,
          volume: next[slotIndex]?.volume ?? PAD_VOLUME_DEFAULT,
        }
        return next
      })
    },
    [clipById, maxPads, updatePads],
  )

  const clearSlot = useCallback(
    (slotIndex: number) => {
      if (slotIndex < 0 || slotIndex >= maxPads) return
      updatePads((prev) => {
        if (!prev[slotIndex]?.clipId) return prev
        const next = prev.map((pad) => ({ ...pad }))
        next[slotIndex] = { ...next[slotIndex], clipId: null }
        return next
      })
    },
    [maxPads, updatePads],
  )

  const setPadVolume = useCallback(
    (slotIndex: number, volume: number) => {
      if (slotIndex < 0 || slotIndex >= maxPads) return
      updatePads((prev) => {
        const next = prev.map((pad) => ({ ...pad }))
        next[slotIndex] = {
          ...next[slotIndex],
          volume: Math.max(0, Math.min(150, Math.round(volume))),
        }
        return next
      })
    },
    [maxPads, updatePads],
  )

  const reorderPads = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= maxPads ||
        toIndex >= maxPads ||
        fromIndex === toIndex
      ) {
        return
      }

      updatePads((prev) => {
        const editable = prev.slice(0, maxPads)
        const rest = prev.slice(maxPads)
        const [moved] = editable.splice(fromIndex, 1)
        editable.splice(toIndex, 0, moved)
        return [...editable, ...rest]
      })
    },
    [maxPads, updatePads],
  )

  const flashSlot = useCallback((slotIndex: number) => {
    setFlashingSlots((prev) => new Set(prev).add(slotIndex))
    window.setTimeout(() => {
      setFlashingSlots((prev) => {
        const next = new Set(prev)
        next.delete(slotIndex)
        return next
      })
    }, 180)
  }, [])

  const slottedClips = useMemo(
    () =>
      Array.from({ length: maxPads }, (_, index) => ({
        index,
        clip: pads[index]?.clipId ? clipById.get(pads[index].clipId!) ?? null : null,
        volume: pads[index]?.volume ?? PAD_VOLUME_DEFAULT,
      })),
    [clipById, maxPads, pads],
  )

  const filledCount = useMemo(
    () => slottedClips.filter((entry) => entry.clip).length,
    [slottedClips],
  )

  return {
    pads,
    slottedClips,
    playableClips,
    assignClipToSlot,
    clearSlot,
    setPadVolume,
    reorderPads,
    flashingSlots,
    flashSlot,
    maxPads,
    filledCount,
    freePadLimit: FREE_SOUNDBOARD_PAD_LIMIT,
  }
}
