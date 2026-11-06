import { useEffect, useState } from 'react'

/** Version reported by the Electron main process. Null until that reply arrives. */
export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    const getVersion = window.electronAPI?.app.getVersion
    if (!getVersion) return
    let cancelled = false
    void getVersion()
      .then((info) => {
        if (!cancelled) setVersion(info.version)
      })
      .catch(() => {
        if (!cancelled) setVersion(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return version
}
