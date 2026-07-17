import { app } from 'electron'
import { getSettings, setSettings, type AppSettings } from './store.js'

export function applyLaunchOnStartup(enabled: boolean): void {
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    return
  }

  const loginSettings: {
    openAtLogin: boolean
    openAsHidden: boolean
    path?: string
    args?: string[]
  } = {
    openAtLogin: enabled,
    openAsHidden: false,
  }

  // Packaged Windows builds need an explicit executable path so the login item
  // points at SlipUpClipz.exe instead of a leftover Electron path.
  if (app.isPackaged && process.platform === 'win32') {
    loginSettings.path = process.execPath
    loginSettings.args = []
  }

  app.setLoginItemSettings(loginSettings)
}

export function getLaunchOnStartupState(): { openAtLogin: boolean } {
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    return { openAtLogin: getSettings().launchOnStartup }
  }

  const osState = app.getLoginItemSettings()
  return { openAtLogin: Boolean(osState.openAtLogin) }
}

export function applySettingsPatch(partial: Partial<AppSettings>): AppSettings {
  const next = setSettings(partial)

  if ('launchOnStartup' in partial) {
    applyLaunchOnStartup(next.launchOnStartup)
  }

  return next
}

export function initializeStartupPreference(): void {
  const stored = getSettings().launchOnStartup
  applyLaunchOnStartup(stored)

  // Keep the persisted setting aligned with the real OS login-item state.
  const osState = getLaunchOnStartupState()
  if (osState.openAtLogin !== stored) {
    setSettings({ launchOnStartup: osState.openAtLogin })
  }
}
