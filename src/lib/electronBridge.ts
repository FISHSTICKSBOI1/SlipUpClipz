import {
  DEFAULT_LICENSE,
  DEFAULT_SETTINGS,
  type AppSettings,
  type LicenseSnapshot,
} from '@shared/appTypes'

export function isElectronApp(): boolean {
  return window.electronAPI?.isElectron === true
}

export async function loadAppSettings(): Promise<AppSettings> {
  if (window.electronAPI?.settings) {
    return window.electronAPI.settings.get()
  }

  return { ...DEFAULT_SETTINGS }
}

export async function saveAppSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  if (window.electronAPI?.settings) {
    return window.electronAPI.settings.set(partial)
  }

  return { ...(await loadAppSettings()), ...partial }
}

export async function loadLicenseState(): Promise<LicenseSnapshot> {
  if (window.electronAPI?.license) {
    return window.electronAPI.license.get()
  }

  return {
    license: { ...DEFAULT_LICENSE },
    isPro: false,
    access: 'free',
    developmentBuild: false,
  }
}

export async function activateLicenseKey(key: string) {
  if (!window.electronAPI?.license) {
    return { ok: false as const, error: 'Licensing is only available in the desktop app.' }
  }

  return window.electronAPI.license.activate(key)
}

export async function deactivateLicenseKey() {
  if (!window.electronAPI?.license) {
    return {
      ok: true as const,
      license: { ...DEFAULT_LICENSE },
      isPro: false,
      access: 'free' as const,
      developmentBuild: false,
    }
  }

  return window.electronAPI.license.deactivate()
}
