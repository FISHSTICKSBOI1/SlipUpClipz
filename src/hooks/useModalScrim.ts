import { useEffect } from 'react'

let openModals = 0

/**
 * Dim the native caption and mark the document so the in-app header
 * stops painting the brighter top glow through the translucent scrim.
 */
export function useModalScrim(opacity: number, active = true) {
  useEffect(() => {
    if (!active) return
    openModals += 1
    document.body.dataset.modalOpen = 'true'
    const setScrim = window.electronAPI?.window.setModalScrim
    void setScrim?.(true, opacity)
    return () => {
      openModals = Math.max(0, openModals - 1)
      if (openModals === 0) delete document.body.dataset.modalOpen
      void setScrim?.(false, opacity)
    }
  }, [active, opacity])
}
