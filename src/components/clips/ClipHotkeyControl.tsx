import { useEffect, useState } from 'react'
import { CLIP_RECORD_HOTKEY } from '@shared/appTypes'
import { formatHotkey, isModifierOnly } from '../../lib/hotkey'

type ClipHotkeyControlProps = {
  value: string
  onSave: (hotkey: string) => void
  compact?: boolean
}

export function ClipHotkeyControl({
  value,
  onSave,
  compact = false,
}: ClipHotkeyControlProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!isCapturing) {
      setDraft(value)
    }
  }, [isCapturing, value])

  useEffect(() => {
    if (!isCapturing) return

    function onKeyDown(event: KeyboardEvent) {
      event.preventDefault()
      if (event.key === 'Escape') {
        setIsCapturing(false)
        setDraft(value)
        return
      }
      if (isModifierOnly(event)) return
      setDraft(formatHotkey(event))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isCapturing, value])

  return (
    <div className={compact ? '' : 'py-4'}>
      <p className="text-sm font-medium text-gray-200">Clip hotkey</p>
      <p className="mt-0.5 text-xs text-gray-500">
        Keyboard shortcut to capture a clip from the replay buffer. Works globally in the desktop
        app.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-hotkey-capture={isCapturing ? 'true' : undefined}
          onClick={() => setIsCapturing(true)}
          className="min-w-[180px] rounded-lg border border-dashed border-surface-border bg-surface-overlay px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-accent hover:text-white"
        >
          {isCapturing ? draft || 'Press keys…' : value}
        </button>

        {isCapturing ? (
          <>
            <button
              type="button"
              disabled={!draft}
              onClick={() => {
                onSave(draft)
                setIsCapturing(false)
              }}
              className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCapturing(false)
                setDraft(value)
              }}
              className="rounded-lg px-3 py-2 text-xs text-gray-400 transition-colors hover:text-gray-200"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsCapturing(true)}
            className="rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-surface-overlay hover:text-white"
          >
            Record new hotkey
          </button>
        )}

        {value !== CLIP_RECORD_HOTKEY && !isCapturing && (
          <button
            type="button"
            onClick={() => onSave(CLIP_RECORD_HOTKEY)}
            className="rounded-lg px-3 py-2 text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            Reset to default
          </button>
        )}
      </div>
    </div>
  )
}
