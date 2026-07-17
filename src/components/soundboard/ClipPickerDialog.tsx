import type { Clip } from '../../types/clip'
import { formatDuration } from '../../lib/format'

type ClipPickerDialogProps = {
  clips: Clip[]
  onSelect: (clipId: string) => void
  onClose: () => void
}

export function ClipPickerDialog({ clips, onSelect, onClose }: ClipPickerDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="panel flex max-h-[80vh] w-full max-w-md flex-col shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clip-picker-title"
      >
        <div className="border-b border-surface-border px-5 py-4">
          <h2 id="clip-picker-title" className="text-base font-semibold text-white">
            Add clip to pad
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Choose a clip with audio for this soundboard pad.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {clips.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-gray-500">
              No playable clips yet. Record and trim a clip first.
            </p>
          ) : (
            <ul className="space-y-1">
              {clips.map((clip) => (
                <li key={clip.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(clip.id)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-overlay"
                  >
                    <span className="truncate text-sm font-medium text-gray-200">
                      {clip.name}
                    </span>
                    <span className="ml-3 shrink-0 text-xs text-gray-500">
                      {formatDuration(clip.durationMs)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-surface-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
