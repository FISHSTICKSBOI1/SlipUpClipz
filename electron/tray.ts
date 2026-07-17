import { Menu, Tray, app, type BrowserWindow } from 'electron'
import { getTrayIconImage } from './appIcon.js'
import { getSettings } from './store.js'

let tray: Tray | null = null
let recordingActive = false
let getMainWindow: (() => BrowserWindow | null) | null = null
let requestAppQuit: (() => void) | null = null

function sendTrayCommand(command: 'toggle-replay-buffer'): void {
  const window = getMainWindow?.()
  if (!window || window.isDestroyed()) return
  window.webContents.send('tray:command', command)
}

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Open SlipUpClipz',
      click: () => showMainWindow(),
    },
    {
      label: recordingActive ? 'Stop replay buffer' : 'Start replay buffer',
      click: () => sendTrayCommand('toggle-replay-buffer'),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        // Intentional full exit — not hide-to-tray.
        if (requestAppQuit) {
          requestAppQuit()
        } else {
          app.quit()
        }
      },
    },
  ])
}

function updateTrayMenu(): void {
  if (!tray || tray.isDestroyed()) return
  tray.setContextMenu(buildTrayMenu())
}

function updateTrayAppearance(): void {
  if (!tray || tray.isDestroyed()) return

  // Always use the official S logo — never swap to colored placeholder dots.
  const icon = getTrayIconImage()
  if (!icon.isEmpty()) {
    tray.setImage(icon)
  }

  tray.setToolTip(
    recordingActive
      ? 'SlipUpClipz — Replay buffer recording'
      : 'SlipUpClipz — Replay buffer idle',
  )
  updateTrayMenu()
}

export function showMainWindow(): void {
  const window = getMainWindow?.()
  if (!window || window.isDestroyed()) return

  if (window.isMinimized()) {
    window.restore()
  }

  window.setSkipTaskbar(false)
  window.show()
  window.focus()

  if (process.platform === 'win32') {
    // Flash briefly so Windows brings the existing instance forward after a second launch.
    window.moveTop()
  }
}

export function setReplayBufferRecording(active: boolean): void {
  recordingActive = active
  updateTrayAppearance()
}

export function setTrayQuitHandler(handler: () => void): void {
  requestAppQuit = handler
}

/**
 * Create the system tray icon once. Reuses an existing Tray when possible
 * so a second call never leaves an orphaned icon in the notification area.
 */
export function createTray(getWindow: () => BrowserWindow | null): Tray {
  getMainWindow = getWindow

  if (tray && !tray.isDestroyed()) {
    updateTrayAppearance()
    return tray
  }

  // Previous reference was destroyed externally — clear before recreating.
  tray = null
  recordingActive = false

  const icon = getTrayIconImage()
  tray = new Tray(icon.isEmpty() ? getTrayIconImage() : icon)
  tray.setToolTip('SlipUpClipz')
  tray.on('double-click', () => showMainWindow())
  tray.on('click', () => showMainWindow())
  updateTrayAppearance()
  return tray
}

export function destroyTray(): void {
  if (tray && !tray.isDestroyed()) {
    tray.destroy()
  }
  tray = null
}

export function shouldMinimizeToTray(): boolean {
  // Historical setting key name — controls close-to-tray only, not taskbar minimize.
  return getSettings().minimizeToTray
}

export function isTrayActive(): boolean {
  return tray !== null && !tray.isDestroyed()
}
