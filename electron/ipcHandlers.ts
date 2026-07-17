import { app, ipcMain, Notification, type BrowserWindow } from 'electron'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openExternalUrl } from './externalLinks.js'
import { registerClipHotkey, syncGlobalHotkeys } from './hotkeys.js'
import {
  disableLoopbackCapture,
  enableLoopbackCapture,
  isLoopbackCaptureSupported,
} from './systemAudio.js'
import {
  activateLicense,
  deactivateLicense,
  isProLicense,
} from './license.js'
import {
  applySettingsPatch,
  getLaunchOnStartupState,
} from './settings.js'
import {
  getLicense,
  getSettings,
  setLicense,
  type HotkeyBinding,
} from './store.js'
import { setReplayBufferRecording, showMainWindow } from './tray.js'
import { showCaptureNotificationOverlay } from './captureNotification.js'
import { toggleWindowFullScreen } from './appMenu.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readAppVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export function showAppNotification(title: string, body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title, body }).show()
}

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:set', (_event, partial) => {
    const next = applySettingsPatch(partial)
    if ('clipHotkey' in partial) {
      registerClipHotkey(getMainWindow())
    }
    return next
  })

  ipcMain.handle('license:get', () => {
    const license = getLicense()
    return {
      license,
      isPro: isProLicense(license),
    }
  })

  ipcMain.handle('license:activate', async (_event, key: string) => {
    const result = await activateLicense(key)
    if (!result.ok) {
      return { ok: false as const, error: result.error }
    }

    setLicense(result.license)
    const window = getMainWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send('license:changed', result.license)
    }

    return {
      ok: true as const,
      license: result.license,
      isPro: isProLicense(result.license),
    }
  })

  ipcMain.handle('license:deactivate', () => {
    const license = deactivateLicense()
    setLicense(license)
    syncGlobalHotkeys(getMainWindow(), [])

    const window = getMainWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send('license:changed', license)
    }

    return { ok: true as const, license, isPro: false }
  })

  ipcMain.handle('hotkeys:sync', (_event, bindings: HotkeyBinding[]) => {
    return syncGlobalHotkeys(getMainWindow(), bindings)
  })

  ipcMain.handle('app:getVersion', () => ({
    // Prefer Electron's packaged version so the updater and UI stay aligned.
    version: app.isPackaged ? app.getVersion() : readAppVersion(),
    platform: process.platform,
  }))

  ipcMain.handle('app:getLoginItemSettings', () => getLaunchOnStartupState())

  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    openExternalUrl(url)
  })

  ipcMain.handle('window:show', () => {
    showMainWindow()
  })

  ipcMain.handle('window:hide', () => {
    const window = getMainWindow()
    if (window && !window.isDestroyed()) {
      window.hide()
    }
  })

  ipcMain.handle('window:maximize', () => {
    const window = getMainWindow()
    if (!window || window.isDestroyed()) return
    window.maximize()
  })

  ipcMain.handle('window:unmaximize', () => {
    const window = getMainWindow()
    if (!window || window.isDestroyed()) return
    window.unmaximize()
  })

  ipcMain.handle('window:toggleMaximize', () => {
    const window = getMainWindow()
    if (!window || window.isDestroyed()) return { isMaximized: false }
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
    return { isMaximized: window.isMaximized() }
  })

  ipcMain.handle('window:toggleFullScreen', () => {
    const window = getMainWindow()
    toggleWindowFullScreen(window)
    return { isFullScreen: window?.isFullScreen() ?? false }
  })

  ipcMain.handle('window:getState', () => {
    const window = getMainWindow()
    if (!window || window.isDestroyed()) {
      return { isMaximized: false, isFullScreen: false }
    }
    return {
      isMaximized: window.isMaximized(),
      isFullScreen: window.isFullScreen(),
    }
  })

  ipcMain.handle('recorder:setStatus', (_event, status: { isListening: boolean }) => {
    setReplayBufferRecording(status.isListening)
  })

  ipcMain.handle('recorder:notify', (_event, payload: { title: string; body: string }) => {
    showAppNotification(payload.title, payload.body)
  })

  ipcMain.handle('recorder:registerClipHotkey', () => {
    return { ok: registerClipHotkey(getMainWindow()) }
  })

  ipcMain.handle('capture-notification:show', async () => {
    await showCaptureNotificationOverlay()
  })

  ipcMain.handle('systemAudio:getCapabilities', () => ({
    loopbackSupported: isLoopbackCaptureSupported(),
    platform: process.platform,
  }))

  ipcMain.handle('systemAudio:enableLoopback', () => {
    enableLoopbackCapture()
  })

  ipcMain.handle('systemAudio:disableLoopback', () => {
    disableLoopbackCapture()
  })
}
