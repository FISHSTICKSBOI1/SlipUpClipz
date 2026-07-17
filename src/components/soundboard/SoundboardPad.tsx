import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../../lib/format'
import type { ActivePlaybackInfo, PlaybackRoute } from '../../lib/soundboardAudio'
import type { Clip, ClipCategory } from '../../types/clip'
import {
  Bars3Icon,
  EllipsisVerticalIcon,
  KeyboardIcon,
  PlayIcon,
  PlusIcon,
  StarIcon,
  StarSolidIcon,
  StopIcon,
} from '../icons'

type SoundboardPadProps = {
  slotIndex: number
  clip: Clip | null
  volume: number
  isFlashing: boolean
  playback: ActivePlaybackInfo | null
  categories: ClipCategory[]
  onPlay: () => void
  onStop: () => void
  onAdd: () => void
  onClear: () => void
  onAssignHotkey: () => void
  onRename: (name: string) => void
  onReplace: () => void
  onToggleFavorite: () => void
  onSetCategory: (categoryId: string | null) => void
  onVolumeChange: (volume: number) => void
  onDragStart: (slotIndex: number) => void
  onDragOver: (slotIndex: number) => void
  onDrop: (slotIndex: number) => void
  isDragOver: boolean
}

function routeLabel(route: PlaybackRoute): string {
  switch (route) {
    case 'both':
      return 'Virtual + Monitor'
    case 'virtual':
      return 'Virtual output'
    default:
      return 'Monitoring'
  }
}

export function SoundboardPad({
  slotIndex,
  clip,
  volume,
  isFlashing,
  playback,
  categories,
  onPlay,
  onStop,
  onAdd,
  onClear,
  onAssignHotkey,
  onRename,
  onReplace,
  onToggleFavorite,
  onSetCategory,
  onVolumeChange,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}: SoundboardPadProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(clip?.name ?? '')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraftName(clip?.name ?? '')
  }, [clip?.name])

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen])

  if (!clip) {
    return (
      <button
        type="button"
        onClick={onAdd}
        onDragOver={(event) => {
          event.preventDefault()
          onDragOver(slotIndex)
        }}
        onDrop={(event) => {
          event.preventDefault()
          onDrop(slotIndex)
        }}
        className={`group flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-gray-500 transition-all ${
          isDragOver
            ? 'border-accent bg-accent/10 text-gray-300'
            : 'border-surface-border bg-surface-overlay/40 hover:border-accent/50 hover:bg-surface-overlay hover:text-gray-300'
        }`}
      >
        <PlusIcon className="h-6 w-6" />
        <span className="text-xs font-medium">Pad {slotIndex + 1}</span>
      </button>
    )
  }

  const isPlaying = Boolean(playback)

  return (
    <div
      draggable
      onDragStart={() => onDragStart(slotIndex)}
      onDragOver={(event) => {
        event.preventDefault()
        onDragOver(slotIndex)
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop(slotIndex)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        setMenuOpen(true)
      }}
      className={`relative flex aspect-square flex-col rounded-xl border p-3 transition-all duration-200 ${
        isDragOver
          ? 'border-accent bg-accent/10'
          : isFlashing || isPlaying
            ? 'border-accent bg-accent/20 shadow-lg shadow-accent/20'
            : 'border-surface-border bg-surface-overlay hover:border-accent/40'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <button
          type="button"
          className="cursor-grab rounded p-0.5 text-gray-600 hover:text-gray-300 active:cursor-grabbing"
          title="Drag to reorder"
          aria-label="Drag to reorder"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Bars3Icon className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title={clip.favorite ? 'Unfavorite' : 'Favorite'}
            aria-label={clip.favorite ? 'Unfavorite' : 'Favorite'}
            onClick={(event) => {
              event.stopPropagation()
              onToggleFavorite()
            }}
            className="rounded p-0.5 text-gray-500 hover:text-amber-300"
          >
            {clip.favorite ? (
              <StarSolidIcon className="h-3.5 w-3.5 text-amber-300" />
            ) : (
              <StarIcon className="h-3.5 w-3.5" />
            )}
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              title="More actions"
              aria-label="More actions"
              onClick={(event) => {
                event.stopPropagation()
                setMenuOpen((open) => !open)
              }}
              className="rounded p-0.5 text-gray-500 hover:text-gray-200"
            >
              <EllipsisVerticalIcon className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 z-20 w-40 rounded-lg border border-surface-border bg-surface-raised py-1 shadow-xl">
                <MenuItem
                  label="Rename"
                  onClick={() => {
                    setRenaming(true)
                    setMenuOpen(false)
                  }}
                />
                <MenuItem
                  label="Replace sound"
                  onClick={() => {
                    onReplace()
                    setMenuOpen(false)
                  }}
                />
                <MenuItem
                  label="Assign hotkey"
                  onClick={() => {
                    onAssignHotkey()
                    setMenuOpen(false)
                  }}
                />
                <div className="my-1 border-t border-surface-border" />
                <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-gray-600">
                  Category
                </p>
                <MenuItem
                  label="Uncategorized"
                  onClick={() => {
                    onSetCategory(null)
                    setMenuOpen(false)
                  }}
                />
                {categories.map((category) => (
                  <MenuItem
                    key={category.id}
                    label={category.name}
                    onClick={() => {
                      onSetCategory(category.id)
                      setMenuOpen(false)
                    }}
                  />
                ))}
                <div className="my-1 border-t border-surface-border" />
                <MenuItem
                  label="Remove from pad"
                  danger
                  onClick={() => {
                    onClear()
                    setMenuOpen(false)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {renaming ? (
        <input
          autoFocus
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={() => {
            onRename(draftName)
            setRenaming(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onRename(draftName)
              setRenaming(false)
            }
            if (event.key === 'Escape') {
              setDraftName(clip.name)
              setRenaming(false)
            }
          }}
          className="mb-1 w-full rounded border border-surface-border bg-surface px-1.5 py-1 text-xs text-white outline-none focus:border-accent"
        />
      ) : (
        <button
          type="button"
          onClick={isPlaying ? onStop : onPlay}
          className="flex min-h-0 flex-1 flex-col items-start text-left"
          title={isPlaying ? `Stop ${clip.name}` : `Play ${clip.name}`}
        >
          <span className="line-clamp-2 text-sm font-semibold text-gray-100">{clip.name}</span>
          <span className="mt-1 text-xs text-gray-500">{formatDuration(clip.durationMs)}</span>
          {clip.hotkey && (
            <span className="mt-1 rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-accent-hover">
              {clip.hotkey}
            </span>
          )}
        </button>
      )}

      {isPlaying && playback && (
        <div className="mt-2 space-y-1">
          <div className="h-1 overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-100"
              style={{ width: `${Math.round(playback.progress * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-accent-hover">{routeLabel(playback.route)}</p>
        </div>
      )}

      <div className="mt-auto flex items-center gap-1 pt-2">
        <button
          type="button"
          onClick={isPlaying ? onStop : onPlay}
          className="rounded-md bg-surface-raised p-1.5 text-gray-300 transition-colors hover:bg-accent hover:text-white"
          title={isPlaying ? 'Stop' : 'Play'}
          aria-label={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? <StopIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={onAssignHotkey}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-surface-raised hover:text-gray-200"
          title="Record hotkey"
          aria-label="Record hotkey"
        >
          <KeyboardIcon className="h-3.5 w-3.5" />
        </button>
        <input
          type="range"
          min={0}
          max={150}
          step={1}
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          title={`Pad volume ${volume}%`}
          aria-label="Pad volume"
          className="min-w-0 flex-1 accent-accent"
        />
        <span className="w-8 text-right text-[10px] tabular-nums text-gray-500">{volume}%</span>
      </div>
    </div>
  )
}

function MenuItem({
  label,
  onClick,
  danger = false,
}: {
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-overlay ${
        danger ? 'text-red-300' : 'text-gray-300'
      }`}
    >
      {label}
    </button>
  )
}
