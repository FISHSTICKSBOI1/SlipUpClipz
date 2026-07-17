import { app, BrowserWindow, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getWindowsIconPath } from './appIcon.js'
import { applyHiddenMenuBar, setupApplicationMenu, toggleWindowFullScreen } from './appMenu.js'
import { openExternalUrl } from './externalLinks.js'
import { registerClipHotkey, unregisterAllHotkeys } from './hotkeys.js'
import { registerIpcHandlers } from './ipcHandlers.js'
import { initializeLicenseValidation, shutdownLicenseValidation } from './license.js'
import { initializeStartupPreference } from './settings.js'
import { disableLoopbackCapture, setupSystemAudioCapture } from './systemAudio.js'
import {
  createTray,
  destroyTray,
  isTrayActive,
  setTrayQuitHandler,
  shouldMinimizeToTray,
  showMainWindow,
} from './tray.js'
import { destroyCaptureNotificationOverlay, isCaptureNotificationWindow } from './captureNotification.js'
import { registerUpdaterIpc, setupAutoUpdater } from './updater.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Group taskbar / toast notifications under the SlipUpClipz app identity on Windows.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.slipupclipz.app')
}

let mainWindow: BrowserWindow | null = null
/** True only when the user (or updater) intentionally exits — not hide-to-tray. */
let intentionalQuitting = false

function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/**
 * Full application quit: stop treating close as hide-to-tray, ask the renderer
 * to release audio, destroy the tray once, close windows, then exit.
 */
function requestAppQuit(): void {
  if (intentionalQuitting) return
  intentionalQuitting = true

  const window = getMainWindow()
  if (window && !window.isDestroyed()) {
    window.webContents.send('app:prepare-quit')
  }

  // Remove the tray icon immediately so it cannot linger while windows close.
  destroyTray()

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.close()
    }
  }

  app.quit()
}

function createWindow() {
  const iconPath = getWindowsIconPath()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    fullscreenable: true,
    fullscreen: false,
    backgroundColor: '#090b12',
    title: 'SlipUpClipz',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  // Keep maximize / fullscreen / resize explicitly enabled (native title-bar controls).
  mainWindow.setMaximizable(true)
  mainWindow.setMinimizable(true)
  mainWindow.setResizable(true)
  mainWindow.setFullScreenable(true)
  applyHiddenMenuBar(mainWindow)

  const emitWindowState = (): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send('window:state', {
      isMaximized: mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen(),
    })
  }

  mainWindow.on('maximize', emitWindowState)
  mainWindow.on('unmaximize', emitWindowState)
  mainWindow.on('enter-full-screen', emitWindowState)
  mainWindow.on('leave-full-screen', emitWindowState)

  // Sole F11 handler — do not also bind F11 as a menu accelerator (double-toggle risk,
  // and hidden Windows menu bars often never deliver accelerators).
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !mainWindow || mainWindow.isDestroyed()) return
    if (input.control || input.alt || input.meta || input.shift) return

    const isF11 = input.key === 'F11' || input.code === 'F11'
    if (isF11) {
      event.preventDefault()
      toggleWindowFullScreen(mainWindow)
      return
    }

    if (input.key === 'Escape' && mainWindow.isFullScreen()) {
      event.preventDefault()
      mainWindow.setFullScreen(false)
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    registerClipHotkey(mainWindow)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    // Real quit (tray Quit, updater, or Close to tray disabled).
    if (intentionalQuitting) {
      return
    }

    if (!shouldMinimizeToTray()) {
      intentionalQuitting = true
      return
    }

    // Close button → hide to tray. Minimize is a separate action (taskbar).
    event.preventDefault()
    if (mainWindow?.isFullScreen()) {
      mainWindow.setFullScreen(false)
    }
    mainWindow?.setSkipTaskbar(true)
    mainWindow?.hide()
  })

  mainWindow.on('show', () => {
    mainWindow?.setSkipTaskbar(false)
  })

  mainWindow.on('closed', () => {
    destroyCaptureNotificationOverlay()
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url)
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// --- Single-instance lock (must run before creating windows/tray) ---
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  // Another SlipUpClipz process already owns the lock — exit immediately.
  // Do not create a window, tray, or replay buffer.
  app.quit()
} else {
  app.on('second-instance', () => {
    // Focus the existing app instead of starting a duplicate process.
    if (!mainWindow || mainWindow.isDestroyed()) {
      if (app.isReady()) {
        createWindow()
        createTray(getMainWindow)
      }
      return
    }
    showMainWindow()
  })

  registerIpcHandlers(getMainWindow)
  registerUpdaterIpc(getMainWindow)
  setTrayQuitHandler(requestAppQuit)

  app.whenReady().then(() => {
    setupApplicationMenu()
    setupSystemAudioCapture()

    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const perm = permission as string
      callback(
        perm === 'media' ||
          perm === 'display-capture' ||
          perm === 'screen',
      )
    })

    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
      const perm = permission as string
      return (
        perm === 'media' ||
        perm === 'display-capture' ||
        perm === 'screen'
      )
    })

    initializeStartupPreference()
    createWindow()
    createTray(getMainWindow)
    initializeLicenseValidation(getMainWindow)
    // Check for updates only after the main window exists (packaged builds only).
    setupAutoUpdater(getMainWindow)

    app.on('activate', () => {
      const mainWindows = BrowserWindow.getAllWindows().filter(
        (win) => !isCaptureNotificationWindow(win),
      )
      if (mainWindows.length === 0) {
        createWindow()
      } else {
        showMainWindow()
      }
    })
  })

  app.on('before-quit', () => {
    intentionalQuitting = true
  })

  app.on('will-quit', () => {
    intentionalQuitting = true
    shutdownLicenseValidation()
    unregisterAllHotkeys()
    disableLoopbackCapture()
    destroyCaptureNotificationOverlay()
    destroyTray()
  })

  app.on('window-all-closed', () => {
    if (process.platform === 'darwin') {
      return
    }

    // Stay alive while hidden to tray.
    if (!intentionalQuitting && shouldMinimizeToTray() && isTrayActive()) {
      return
    }

    requestAppQuit()
  })
}
