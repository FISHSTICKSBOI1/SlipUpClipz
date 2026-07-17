import { BrowserWindow, screen, app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const OVERLAY_WIDTH = 260
const OVERLAY_HEIGHT = 68
const MARGIN_PX = 20
/** Visible time before exit animation starts. */
const VISIBLE_MS = 1700
/** Exit animation duration — keep in sync with overlay CSS. */
const EXIT_MS = 280

/**
 * High enough to sit above Discord maximized / borderless fullscreen,
 * without using invasive exclusive-fullscreen game hacks.
 */
const OVERLAY_TOP_LEVEL = 'screen-saver' as const

let overlayWindow: BrowserWindow | null = null
let hideTimer: NodeJS.Timeout | null = null
let cachedLogoDataUrl: string | null = null

function projectRoot(): string {
  return path.join(__dirname, '..')
}

function firstExisting(...candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return null
}

function logOverlay(message: string, details?: Record<string, unknown>): void {
  if (app.isPackaged) return
  if (details) {
    console.info(`[capture-notification] ${message}`, details)
  } else {
    console.info(`[capture-notification] ${message}`)
  }
}

/** Resolve the real SlipUpClipz “S” logo for the overlay (dev + packaged). */
function resolveLogoDataUrl(): string | null {
  if (cachedLogoDataUrl) return cachedLogoDataUrl

  const logoPath = firstExisting(
    path.join(process.resourcesPath, 'icon-64.png'),
    path.join(process.resourcesPath, 'icon-32.png'),
    path.join(process.resourcesPath, 'tray-icon.png'),
    path.join(app.getAppPath(), 'dist', 'app-icon.png'),
    path.join(projectRoot(), 'dist', 'app-icon.png'),
    path.join(projectRoot(), 'public', 'app-icon.png'),
    path.join(projectRoot(), 'build', 'icon-64.png'),
    path.join(projectRoot(), 'build', 'icon-32.png'),
    path.join(projectRoot(), 'build', 'icon.png'),
  )

  if (!logoPath) return null

  try {
    const bytes = readFileSync(logoPath)
    const ext = path.extname(logoPath).toLowerCase()
    const mime = ext === '.ico' ? 'image/x-icon' : 'image/png'
    cachedLogoDataUrl = `data:${mime};base64,${bytes.toString('base64')}`
    return cachedLogoDataUrl
  } catch {
    return null
  }
}

function buildOverlayHtml(logoDataUrl: string | null): string {
  const logoMarkup = logoDataUrl
    ? `<img class="logo" src="${logoDataUrl}" alt="" width="28" height="28" draggable="false" />`
    : `<span class="logo-fallback" aria-hidden="true">S</span>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'" />
  <title>SlipUpClipz</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      -webkit-user-select: none;
      user-select: none;
    }
    .toast {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 12px;
      width: calc(100% - 8px);
      height: calc(100% - 8px);
      margin: 4px;
      padding: 0 14px 0 12px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(18, 22, 31, 0.94);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
      opacity: 0;
      transform: translateX(18px);
      transition: opacity 220ms ease, transform 220ms ease;
    }
    .toast.show {
      opacity: 1;
      transform: translateX(0);
    }
    .toast.hide {
      opacity: 0;
      transform: translateX(14px);
      transition-duration: ${EXIT_MS}ms;
    }
    .logo-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 11px;
      background: rgba(124, 92, 255, 0.22);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
      overflow: hidden;
    }
    .logo {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      object-fit: cover;
    }
    .logo-fallback {
      color: #b7a6ff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .label {
      color: #f3f5fb;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="toast" id="toast">
    <div class="logo-wrap">${logoMarkup}</div>
    <span class="label">Clip captured!</span>
  </div>
  <script>
    const toast = document.getElementById('toast');
    function playIn() {
      toast.classList.remove('hide');
      // Force reflow so re-triggering the animation works on reuse.
      void toast.offsetWidth;
      requestAnimationFrame(() => toast.classList.add('show'));
    }
    function playOut() {
      toast.classList.remove('show');
      toast.classList.add('hide');
    }
    window.__slipupCaptureToast = { playIn, playOut };
    playIn();
  </script>
</body>
</html>`
}

function clearHideTimer(): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function assertOverlayZOrder(win: BrowserWindow): void {
  // Re-apply after show — Windows z-order can drop otherwise when Discord is topmost.
  win.setAlwaysOnTop(true, OVERLAY_TOP_LEVEL)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(true, { forward: true })
  try {
    win.moveTop()
  } catch {
    // moveTop is best-effort and must never steal focus.
  }
}

function positionOverlay(win: BrowserWindow): void {
  const point = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(point)
  const area = display.workArea

  const x = Math.round(area.x + area.width - OVERLAY_WIDTH - MARGIN_PX)
  const y = Math.round(area.y + MARGIN_PX)

  win.setBounds({
    x,
    y,
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
  })

  logOverlay('position', {
    cursor: point,
    displayId: display.id,
    bounds: display.bounds,
    workArea: area,
    overlay: { x, y, width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT },
  })
}

function ensureOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow
  }

  const win = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    title: '',
    // Independent overlay — never parented to the main window.
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  })

  win.setMenu(null)
  win.setAlwaysOnTop(true, OVERLAY_TOP_LEVEL)
  win.setIgnoreMouseEvents(true, { forward: true })
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.on('closed', () => {
    if (overlayWindow === win) {
      overlayWindow = null
    }
  })

  overlayWindow = win
  return win
}

export function isCaptureNotificationWindow(win: BrowserWindow): boolean {
  return overlayWindow !== null && overlayWindow === win
}

function scheduleHide(win: BrowserWindow): void {
  clearHideTimer()
  hideTimer = setTimeout(() => {
    hideTimer = null
    if (win.isDestroyed()) return

    void win.webContents
      .executeJavaScript(
        `window.__slipupCaptureToast && window.__slipupCaptureToast.playOut()`,
      )
      .catch(() => {
        // Overlay may already be gone.
      })

    setTimeout(() => {
      if (!win.isDestroyed() && win.isVisible()) {
        win.hide()
      }
    }, EXIT_MS + 40)
  }, VISIBLE_MS)
}

/**
 * Show (or refresh) the top-right “Clip captured” overlay on the active display.
 * Never steals focus. Safe no-op on failure.
 */
export async function showCaptureNotificationOverlay(): Promise<void> {
  try {
    const win = ensureOverlayWindow()
    const logoDataUrl = resolveLogoDataUrl()
    const html = buildOverlayHtml(logoDataUrl)

    positionOverlay(win)

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    // Never use show()/focus() — keep Discord / games focused.
    if (!win.isVisible()) {
      win.showInactive()
    } else {
      void win.webContents
        .executeJavaScript(
          `window.__slipupCaptureToast && window.__slipupCaptureToast.playIn()`,
        )
        .catch(() => {
          // Ignore — loadURL already ran playIn.
        })
    }

    assertOverlayZOrder(win)
    logOverlay('shown', {
      visible: win.isVisible(),
      alwaysOnTop: win.isAlwaysOnTop(),
      level: OVERLAY_TOP_LEVEL,
      focusable: win.isFocusable(),
    })

    scheduleHide(win)
  } catch (error) {
    console.warn('[capture-notification] Unable to show overlay:', error)
  }
}

/** Destroy the overlay window (app quit). */
export function destroyCaptureNotificationOverlay(): void {
  clearHideTimer()
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy()
  }
  overlayWindow = null
}
