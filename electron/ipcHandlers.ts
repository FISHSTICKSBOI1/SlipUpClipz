import { app, ipcMain, Notification, type BrowserWindow } from 'electron'
import { getDisplayedAppVersion } from './appVersion.js'
import { openExternalUrl } from './externalLinks.js'
import { registerClipHotkey, syncGlobalHotkeys } from './hotkeys.js'
import {
  disableLoopbackCapture,
  enableLoopbackCapture,
  isLoopbackCaptureSupported,
} from './systemAudio.js'
import {
  activateLicense,
  confirmDeviceTransfer,
  currentLicenseSnapshot,
  deactivateLicense,
  isProLicense,
  publishLicenseState,
  releaseStoredLicense,
  requestDeviceTransfer,
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
import { registerAiVoiceIpc } from './aiVoice.js'
import { billingPortalEndpoint, requestBillingPortalSession } from './billingPortal.js'
import { setWindowModalScrim } from './windowsCaption.js'
import { authorizeRemoveSelection } from './removeSelectionGate.js'

export function showAppNotification(title: string, body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title, body }).show()
}

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  registerAiVoiceIpc(getMainWindow)
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:set', (_event, partial) => {
    const next = applySettingsPatch(partial)
    if (partial && typeof partial === 'object' && 'clipHotkey' in partial) {
      registerClipHotkey(getMainWindow())
    }
    if (partial && typeof partial === 'object' && 'devProTesting' in partial && !app.isPackaged) {
      publishLicenseState()
    }
    return next
  })

  ipcMain.handle('license:get', () => currentLicenseSnapshot())

  ipcMain.handle('clips:authorizeRemoveSelection', (event) => {
    const window = getMainWindow()
    if (!window || event.sender.id !== window.webContents.id) {
      return { ok: false as const, error: 'Unexpected request source.' }
    }
    return authorizeRemoveSelection(isProLicense(getLicense()))
  })

  ipcMain.handle('license:activate', async (_event, key: string) => {
    const result = await activateLicense(key)
    if (!result.ok) {
      return { ok: false as const, error: result.error }
    }

    setLicense(result.license)
    const snapshot = currentLicenseSnapshot()
    const window = getMainWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send('license:changed', snapshot)
    }

    return { ok: true as const, ...snapshot }
  })

  ipcMain.handle(
    'license:open-billing-portal',
    async (_event, payload: { licenseKey?: string; email?: string }) => {
      const licenseKey = typeof payload?.licenseKey === 'string' ? payload.licenseKey : ''
      const email = typeof payload?.email === 'string' ? payload.email : ''
      const stored = getLicense()
      if (
        stored.devDemo &&
        stored.key &&
        licenseKey.trim().toUpperCase() === stored.key.trim().toUpperCase()
      ) {
        return { ok: false as const, error: 'Development demo keys cannot open billing.' }
      }

      const result = await requestBillingPortalSession({
        endpoint: billingPortalEndpoint(app.isPackaged),
        licenseKey,
        email,
      })
      if (!result.ok) return result

      openExternalUrl(result.url)
      return { ok: true as const }
    },
  )

  ipcMain.handle('license:deactivate', async () => {
    const released = await releaseStoredLicense()
    const license = deactivateLicense()
    setLicense(license)
    syncGlobalHotkeys(getMainWindow(), [])
    const snapshot = currentLicenseSnapshot()

    const window = getMainWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send('license:changed', snapshot)
    }

    return { ok: true as const, ...snapshot, warning: released.warning }
  })

  ipcMain.handle('license:request-transfer', (_event, payload: { licenseKey?: string; email?: string }) => {
    return requestDeviceTransfer({
      licenseKey: payload?.licenseKey ?? '',
      email: payload?.email ?? '',
    })
  })

  ipcMain.handle('license:confirm-transfer', (_event, payload: { licenseKey?: string; code?: string }) => {
    return confirmDeviceTransfer({
      licenseKey: payload?.licenseKey ?? '',
      code: payload?.code ?? '',
    })
  })

  ipcMain.handle('hotkeys:sync', (_event, bindings: HotkeyBinding[]) => {
    return syncGlobalHotkeys(getMainWindow(), bindings)
  })

  ipcMain.handle('app:getVersion', () => ({
    version: getDisplayedAppVersion(),
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

  ipcMain.handle('window:setModalScrim', (_event, active: boolean, opacity?: number) => {
    const scrim = typeof opacity === 'number' && Number.isFinite(opacity) ? opacity : 0.6
    setWindowModalScrim(getMainWindow(), active === true, scrim)
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
