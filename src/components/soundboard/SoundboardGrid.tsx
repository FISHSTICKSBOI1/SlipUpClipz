import { useEffect, useMemo, useRef, useState } from 'react'
import { FREE_SOUNDBOARD_PAD_LIMIT } from '@shared/appTypes'
import { useAppSettings } from '../../context/AppSettingsContext'
import { useClipLibraryContext } from '../../context/ClipLibraryContext'
import { useLicense } from '../../context/LicenseContext'
import { useSoundboard } from '../../hooks/useSoundboard'
import {
  getActivePlaybacks,
  subscribePlaybackState,
  warmUpAudioEngine,
  type ActivePlaybackInfo,
} from '../../lib/soundboardAudio'
import { SOUNDBOARD_COLUMNS, SOUNDBOARD_SLOT_COUNT } from '../../lib/soundboardStorage'
import { PaywallNotice } from '../license/PaywallNotice'
import { HotkeyDialog } from '../clips/HotkeyDialog'
import { SearchIcon } from '../icons'
import { ClipPickerDialog } from './ClipPickerDialog'
import { SoundboardPad } from './SoundboardPad'

export type SoundboardFilter = 'all' | 'favorites' | 'recent' | 'recorded' | 'imported'

type SoundboardGridProps = {
  filter: SoundboardFilter
  search: string
  onRequestImport: () => void
  highlightClipIds?: Set<string> | null
}

export function SoundboardGrid({
  filter,
  search,
  onRequestImport,
  highlightClipIds = null,
}: SoundboardGridProps) {
  const {
    clips,
    categories,
    playClipSoundboard,
    stopClipSoundboard,
    assignHotkey,
    renameClip,
    toggleFavorite,
    setClipCategory,
    replaceClipAudio,
  } = useClipLibraryContext()
  const { settings } = useAppSettings()
  const { isPro } = useLicense()
  const maxPads = isPro ? SOUNDBOARD_SLOT_COUNT : FREE_SOUNDBOARD_PAD_LIMIT
  const {
    slottedClips,
    playableClips,
    assignClipToSlot,
    clearSlot,
    setPadVolume,
    reorderPads,
    flashingSlots,
    flashSlot,
    filledCount,
    freePadLimit,
  } = useSoundboard(clips, maxPads)

  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [hotkeyTarget, setHotkeyTarget] = useState<string | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [playbacks, setPlaybacks] = useState<ActivePlaybackInfo[]>(() => getActivePlaybacks())
  const [error, setError] = useState<string | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const replaceClipIdRef = useRef<string | null>(null)

  const hotkeyClip = clips.find((clip) => clip.id === hotkeyTarget)

  useEffect(() => {
    const unsubscribe = subscribePlaybackState(() => {
      setPlaybacks(getActivePlaybacks())
    })
    const interval = window.setInterval(() => {
      setPlaybacks(getActivePlaybacks())
    }, 100)
    return () => {
      unsubscribe()
      window.clearInterval(interval)
    }
  }, [])

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) {
      map.set(category.id, category.name)
    }
    return map
  }, [categories])

  const visibleSlots = useMemo(() => {
    const query = search.trim().toLowerCase()

    return slottedClips.filter(({ clip }) => {
      if (!clip) {
        return filter === 'all' && !query
      }

      if (highlightClipIds && !highlightClipIds.has(clip.id)) {
        return false
      }

      if (filter === 'favorites' && !clip.favorite) return false
      if (filter === 'recorded' && clip.source === 'imported') return false
      if (filter === 'imported' && clip.source !== 'imported') return false
      if (filter === 'recent') {
        // recent filter is applied via ordering of filled pads below
      }

      if (!query) return true

      const categoryName = clip.categoryId
        ? categoryNameById.get(clip.categoryId) ?? ''
        : 'uncategorized'

      return (
        clip.name.toLowerCase().includes(query) ||
        clip.hotkey?.toLowerCase().includes(query) ||
        clip.originalFileName?.toLowerCase().includes(query) ||
        categoryName.toLowerCase().includes(query)
      )
    })
  }, [categoryNameById, filter, highlightClipIds, search, slottedClips])

  const orderedVisibleSlots = useMemo(() => {
    if (filter !== 'recent') return visibleSlots
    return [...visibleSlots].sort((a, b) => {
      const aTime = a.clip?.lastPlayedAt ?? 0
      const bTime = b.clip?.lastPlayedAt ?? 0
      return bTime - aTime
    })
  }, [filter, visibleSlots])

  const playbackByClipId = useMemo(() => {
    const map = new Map<string, ActivePlaybackInfo>()
    for (const playback of playbacks) {
      if (!map.has(playback.clipId)) {
        map.set(playback.clipId, playback)
      }
    }
    return map
  }, [playbacks])

  async function handlePlay(slotIndex: number, clipId: string, volume: number) {
    warmUpAudioEngine()
    flashSlot(slotIndex)
    await playClipSoundboard(clipId, volume)
  }

  function handleReplace(clipId: string) {
    replaceClipIdRef.current = clipId
    replaceInputRef.current?.click()
  }

  async function onReplaceFileSelected(file: File | undefined) {
    const clipId = replaceClipIdRef.current
    replaceClipIdRef.current = null
    if (!file || !clipId) return
    const result = await replaceClipAudio(clipId, file)
    if (!result.ok) {
      setError(result.error)
    }
  }

  const showEmptyBoard = filledCount === 0 && filter === 'all' && !search.trim()
  const showNoMatches =
    !showEmptyBoard && orderedVisibleSlots.every((entry) => !entry.clip) && (Boolean(search.trim()) || filter !== 'all')

  return (
    <>
      {!isPro && (
        <div className="mb-4">
          <PaywallNotice feature="unlimitedPads" compact />
          <p className="mt-2 text-xs text-gray-500">
            Free plan includes {freePadLimit} of {SOUNDBOARD_SLOT_COUNT} pads.
          </p>
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {showEmptyBoard ? (
        <div className="rounded-xl border border-dashed border-surface-border bg-surface-overlay/20 px-6 py-12 text-center">
          <h3 className="text-base font-semibold text-white">Your soundboard is empty</h3>
          <p className="mt-2 text-sm text-gray-400">
            Add a saved clip or import an MP3 or WAV file to get started.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPickerSlot(0)}
              className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Add Saved Clip
            </button>
            <button
              type="button"
              onClick={onRequestImport}
              className="rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:border-accent hover:text-white"
            >
              Import Audio
            </button>
          </div>
        </div>
      ) : showNoMatches ? (
        <div className="rounded-xl border border-dashed border-surface-border bg-surface-overlay/20 px-6 py-10 text-center">
          <SearchIcon className="mx-auto h-6 w-6 text-gray-600" />
          <h3 className="mt-3 text-sm font-semibold text-white">No matching sounds found</h3>
          <p className="mt-1 text-xs text-gray-500">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="max-h-[min(70vh,52rem)] overflow-y-auto rounded-2xl border border-surface-border/60 bg-surface-overlay/10 p-3">
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${SOUNDBOARD_COLUMNS}, minmax(0, 1fr))` }}
          >
            {orderedVisibleSlots.map(({ index, clip, volume }) => (
              <SoundboardPad
                key={`${index}-${clip?.id ?? 'empty'}`}
                slotIndex={index}
                clip={clip}
                volume={volume}
                isFlashing={flashingSlots.has(index)}
                playback={clip ? playbackByClipId.get(clip.id) ?? null : null}
                categories={categories}
                onPlay={() => clip && void handlePlay(index, clip.id, volume)}
                onStop={() => clip && stopClipSoundboard(clip.id)}
                onAdd={() => setPickerSlot(index)}
                onClear={() => clearSlot(index)}
                onAssignHotkey={() => clip && setHotkeyTarget(clip.id)}
                onRename={(name) => clip && renameClip(clip.id, name)}
                onReplace={() => clip && handleReplace(clip.id)}
                onToggleFavorite={() => clip && toggleFavorite(clip.id)}
                onSetCategory={(categoryId) => clip && setClipCategory(clip.id, categoryId)}
                onVolumeChange={(nextVolume) => setPadVolume(index, nextVolume)}
                onDragStart={(from) => setDragFrom(from)}
                onDragOver={(over) => setDragOver(over)}
                onDrop={(to) => {
                  if (dragFrom !== null) {
                    reorderPads(dragFrom, to)
                  }
                  setDragFrom(null)
                  setDragOver(null)
                }}
                isDragOver={dragOver === index}
              />
            ))}

            {!isPro &&
              filter === 'all' &&
              !search.trim() &&
              Array.from({ length: 3 }, (_, offset) => (
                <div
                  key={`locked-${offset}`}
                  className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-surface-border bg-surface-overlay/20 p-3 text-center"
                >
                  <span className="text-xs font-medium text-gray-500">Pro pads</span>
                  <span className="mt-1 text-[10px] text-gray-600">
                    Unlock {SOUNDBOARD_SLOT_COUNT - maxPads} total
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <input
        ref={replaceInputRef}
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav,audio/wave,audio/x-wav"
        className="hidden"
        onChange={(event) => {
          void onReplaceFileSelected(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      {pickerSlot !== null && (
        <ClipPickerDialog
          clips={playableClips}
          onSelect={(clipId) => {
            assignClipToSlot(pickerSlot, clipId)
            setPickerSlot(null)
          }}
          onClose={() => setPickerSlot(null)}
        />
      )}

      {hotkeyClip && (
        <HotkeyDialog
          clipId={hotkeyClip.id}
          clipName={hotkeyClip.name}
          currentHotkey={hotkeyClip.hotkey}
          clips={clips}
          clipHotkey={settings.clipHotkey}
          stopAllHotkey={settings.stopAllHotkey}
          onSave={(hotkey) => {
            assignHotkey(hotkeyClip.id, hotkey)
            setHotkeyTarget(null)
          }}
          onClose={() => setHotkeyTarget(null)}
        />
      )}
    </>
  )
}
