import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  activateLicenseKey,
  deactivateLicenseKey,
  loadLicenseState,
} from '../lib/electronBridge'
import type { LicenseAccess, LicenseSnapshot, LicenseState } from '@shared/appTypes'

type LicenseContextValue = {
  license: LicenseState
  isPro: boolean
  access: LicenseAccess
  developmentBuild: boolean
  isLoading: boolean
  activate: (key: string) => Promise<{ ok: boolean; error?: string }>
  deactivate: () => Promise<{ ok: boolean; warning?: string }>
}

const LicenseContext = createContext<LicenseContextValue | null>(null)

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [license, setLicense] = useState<LicenseState>({ activated: false, tier: 'free' })
  const [isPro, setIsPro] = useState(false)
  const [access, setAccess] = useState<LicenseAccess>('free')
  const [developmentBuild, setDevelopmentBuild] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  function applySnapshot(snapshot: LicenseSnapshot) {
    setLicense(snapshot.license)
    setIsPro(snapshot.isPro)
    setAccess(snapshot.access)
    setDevelopmentBuild(snapshot.developmentBuild)
  }

  useEffect(() => {
    void loadLicenseState().then((result) => {
      applySnapshot(result)
      setIsLoading(false)
    })

    const unsubscribe = window.electronAPI?.onLicenseChanged?.((snapshot) => {
      applySnapshot(snapshot)
    })

    return () => unsubscribe?.()
  }, [])

  async function activate(key: string) {
    const result = await activateLicenseKey(key)
    if (result.ok) {
      applySnapshot(result)
      return { ok: true }
    }

    return { ok: false, error: result.error }
  }

  async function deactivate() {
    const result = await deactivateLicenseKey()
    if (result.ok) {
      applySnapshot(result)
    }
    return result
    return result
  }

  return (
    <LicenseContext.Provider
      value={{ license, isPro, access, developmentBuild, isLoading, activate, deactivate }}
    >
      {children}
    </LicenseContext.Provider>
  )
}

export function useLicense() {
  const context = useContext(LicenseContext)
  if (!context) {
    throw new Error('useLicense must be used within LicenseProvider')
  }
  return context
}
