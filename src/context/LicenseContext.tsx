import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  activateLicenseKey,
  deactivateLicenseKey,
  loadLicenseState,
} from '../lib/electronBridge'
import type { LicenseState } from '@shared/appTypes'

type LicenseContextValue = {
  license: LicenseState
  isPro: boolean
  isLoading: boolean
  activate: (key: string) => Promise<{ ok: boolean; error?: string }>
  deactivate: () => Promise<void>
}

const LicenseContext = createContext<LicenseContextValue | null>(null)

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [license, setLicense] = useState<LicenseState>({ activated: false, tier: 'free' })
  const [isPro, setIsPro] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void loadLicenseState().then((result) => {
      setLicense(result.license)
      setIsPro(result.isPro)
      setIsLoading(false)
    })

    const unsubscribe = window.electronAPI?.onLicenseChanged?.((next) => {
      setLicense(next)
      setIsPro(next.tier === 'pro' && next.activated)
    })

    return () => unsubscribe?.()
  }, [])

  async function activate(key: string) {
    const result = await activateLicenseKey(key)
    if (result.ok) {
      setLicense(result.license)
      setIsPro(result.isPro)
      return { ok: true }
    }

    return { ok: false, error: result.error }
  }

  async function deactivate() {
    const result = await deactivateLicenseKey()
    if (result.ok) {
      setLicense(result.license)
      setIsPro(result.isPro)
    }
  }

  return (
    <LicenseContext.Provider value={{ license, isPro, isLoading, activate, deactivate }}>
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
