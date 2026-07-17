import { useState } from 'react'
import { formatDuration, formatRelativeDate } from '../../lib/format'
import type { Clip } from '../../types/clip'
import {
  ArrowDownTrayIcon,
  KeyboardIcon,
  PencilIcon,
  PlayIcon,
  ScissorsIcon,
  TrashIcon,
} from '../icons'

type ClipCardProps = {
  clip: Clip
  isPlaying: boolean
  onPlay: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onAssignHotkey: () => void
  onExport: () => void
  onTrim: () => void
}

export function ClipCard({
  clip,
  isPlaying,
  onPlay,
  onRename,
  onDelete,
  onAssignHotkey,
  onExport,
  onTrim,
}: ClipCardProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(clip.name)

  function commitRename() {
    onRename(draftName)
    setIsRenaming(false)
  }

  function startRename() {
    setDraftName(clip.name)
    setIsRenaming(true)
  }

  const canPlay = clip.hasAudio === true

  return (
    <article className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <button
          type="button"
          onClick={onPlay}
          disabled={!canPlay}
          aria-label={canPlay ? `Play ${clip.name}` : `${clip.name} has no audio`}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all ${
            isPlaying
              ? 'bg-accent text-white shadow-glow'
              : canPlay
                ? 'bg-white/5 text-ink-soft hover:bg-accent hover:text-white'
                : 'cursor-not-allowed bg-white/5 text-ink-faint'
          }`}
        >
          <PlayIcon className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') {
                  setDraftName(clip.name)
                  setIsRenaming(false)
                }
              }}
              className="field-input !py-1.5"
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-white">{clip.name}</h3>
              {clip.isDraft ? (
                <span className="badge-amber">Draft</span>
              ) : clip.hasAudio ? (
                <span className="badge-live">Recorded</span>
              ) : (
                <span className="badge-idle">Sample</span>
              )}
            </div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 helper-text">
            <span>{formatDuration(clip.durationMs)}</span>
            <span>·</span>
            <span>{formatRelativeDate(clip.createdAt)}</span>
            {clip.hotkey && (
              <>
                <span>·</span>
                <span className="rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-ink-soft">
                  {clip.hotkey}
                </span>
              </>
            )}
          </div>

          {isPlaying && <p className="mt-2 text-xs font-semibold text-accent-hover">Playing…</p>}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
        {canPlay && (
          <ActionButton label="Trim" icon={ScissorsIcon} onClick={onTrim} />
        )}
        <ActionButton label="Rename" icon={PencilIcon} onClick={startRename} />
        {canPlay && !clip.isDraft && (
          <ActionButton label="Export" icon={ArrowDownTrayIcon} onClick={onExport} />
        )}
        <ActionButton label="Assign hotkey" icon={KeyboardIcon} onClick={onAssignHotkey} />
        <ActionButton label="Delete" icon={TrashIcon} onClick={onDelete} variant="danger" />
      </div>
    </article>
  )
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  variant = 'default',
}: {
  label: string
  icon: typeof PencilIcon
  onClick: () => void
  variant?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
        variant === 'danger'
          ? 'text-gray-400 hover:bg-red-500/10 hover:text-red-400'
          : 'text-gray-400 hover:bg-surface-overlay hover:text-gray-200'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden lg:inline">{label}</span>
    </button>
  )
}
