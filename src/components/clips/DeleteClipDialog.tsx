import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useModalScrim } from '../../hooks/useModalScrim'

type DeleteClipDialogProps = {
  clipName: string
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteClipDialog({ clipName, onCancel, onConfirm }: DeleteClipDialogProps) {
  useModalScrim(0.7)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key !== 'Tab') {
        event.stopPropagation()
        return
      }

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled])')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onCancel])

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div
        ref={dialogRef}
        className="panel w-full max-w-sm p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-clip-title"
        aria-describedby="delete-clip-message"
      >
        <h2 id="delete-clip-title" className="text-base font-semibold text-white">
          Delete clip?
        </h2>
        <p id="delete-clip-message" className="mt-2 text-sm leading-relaxed text-gray-400">
          Are you sure you want to permanently delete "
          <span className="break-words font-medium text-gray-200">{clipName}</span>
          "? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="btn-danger">
            Delete clip
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
