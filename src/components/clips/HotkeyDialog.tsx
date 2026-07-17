import { useEffect, useMemo, useRef, useState } from 'react'
import { CLIP_RECORD_HOTKEY, STOP_ALL_SOUNDS_HOTKEY } from '@shared/appTypes'
import { formatHotkey, isModifierOnly } from '../../lib/hotkey'
import type { Clip } from '../../types/clip'

type HotkeyConflict = {
  kind: 'clip' | 'clip-hotkey' | 'stop-all'
  label: string
}

type HotkeyDialogProps = {
  clipName: string
  clipId: string
  currentHotkey?: string
  clips: Clip[]
  clipHotkey?: string
  stopAllHotkey?: string
  onSave: (hotkey: string | undefined) => void
  onClose: () => void
}

export function HotkeyDialog({
  clipName,
  clipId,
  currentHotkey,
  clips,
  clipHotkey = CLIP_RECORD_HOTKEY,
  stopAllHotkey = STOP_ALL_SOUNDS_HOTKEY,
  onSave,
  onClose,
}: HotkeyDialogProps) {
  const [captured, setCaptured] = useState(currentHotkey ?? '')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const inputRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      event.preventDefault()
      if (event.key === 'Escape') {
        if (confirmReplace) {
          setConfirmReplace(false)
          return
        }
        onClose()
        return
      }
      if (isModifierOnly(event)) return
      setCaptured(formatHotkey(event))
      setConfirmReplace(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmReplace, onClose])

  const conflict = useMemo((): HotkeyConflict | null => {
    if (!captured) return null
    if (captured === clipHotkey) {
      return { kind: 'clip-hotkey', label: 'the Clip capture hotkey' }
    }
    if (stopAllHotkey && captured === stopAllHotkey) {
      return { kind: 'stop-all', label: 'Stop All Sounds' }
    }
    const other = clips.find((clip) => clip.id !== clipId && clip.hotkey === captured)
    if (other) {
      return { kind: 'clip', label: other.name }
    }
    return null
  }, [captured, clipHotkey, clipId, clips, stopAllHotkey])

  function handleSave() {
    if (!captured) return
    if (conflict && !confirmReplace) {
      setConfirmReplace(true)
      return
    }
    onSave(captured)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-hotkey-capture>
      <div
        className="panel w-full max-w-md p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotkey-dialog-title"
      >
        <h2 id="hotkey-dialog-title" className="text-base font-semibold text-white">
          Record Hotkey
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Press a key combination for <span className="text-gray-200">{clipName}</span>.
        </p>

        <button
          ref={inputRef}
          type="button"
          className="mt-5 flex w-full items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface-overlay px-4 py-6 text-sm font-medium text-gray-300 transition-colors hover:border-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {captured || 'Press keys…'}
        </button>

        {conflict && (
          <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {confirmReplace
              ? `This will replace the hotkey currently used by ${conflict.label}. Continue?`
              : `This shortcut is already used by ${conflict.label}.`}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          {currentHotkey && (
            <button
              type="button"
              onClick={() => onSave(undefined)}
              className="rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:text-red-400"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!captured}
            onClick={handleSave}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {confirmReplace ? 'Replace & Save' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
