import { Menu, app, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { EXTERNAL_LINKS } from '../shared/externalLinks.js'
import { openExternalUrl } from './externalLinks.js'
import { getSettings } from './store.js'

function buildHelpSubmenu(): MenuItemConstructorOptions[] {
  return [
    {
      label: 'Open Help Center',
      click: () => openExternalUrl(EXTERNAL_LINKS.helpCenter),
    },
    {
      label: 'Contact Support',
      click: () => openExternalUrl(EXTERNAL_LINKS.contactSupport),
    },
  ]
}

/**
 * Centralized true-fullscreen toggle for the main BrowserWindow.
 * Does NOT use maximize(). Honors Settings → Allow F11 fullscreen.
 * Escape exits fullscreen separately in main.ts.
 */
export function toggleWindowFullScreen(window: BrowserWindow | null | undefined): boolean {
  if (!window || window.isDestroyed()) return false
  if (!getSettings().allowF11Fullscreen) {
    return false
  }

  const next = !window.isFullScreen()
  window.setFullScreen(next)
  return window.isFullScreen() === next
}

/**
 * Application menu:
 * - macOS: system menu bar (includes Ctrl+Cmd+F fullscreen — no separate UI button)
 * - Windows/Linux: Help only; F11 is handled by before-input-event (no Fullscreen menu item)
 */
export function setupApplicationMenu(): void {
  if (process.platform === 'darwin') {
    const template: MenuItemConstructorOptions[] = [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          {
            label: 'Toggle Full Screen',
            accelerator: 'Ctrl+Command+F',
            click: (_item, focusedWindow) => {
              toggleWindowFullScreen(focusedWindow as BrowserWindow | undefined)
            },
          },
        ],
      },
      {
        label: 'Window',
        submenu: [{ role: 'minimize' }, { type: 'separator' }, { role: 'front' }],
      },
      {
        label: 'Help',
        submenu: buildHelpSubmenu(),
      },
    ]

    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
    return
  }

  // Windows / Linux: no Fullscreen menu/button — F11 uses before-input-event.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Help',
        submenu: buildHelpSubmenu(),
      },
    ]),
  )
}

/** Hide the Windows/Linux menu bar. */
export function applyHiddenMenuBar(window: BrowserWindow): void {
  if (process.platform === 'darwin') return
  window.setAutoHideMenuBar(true)
  window.setMenuBarVisibility(false)
}

export function buildTrayHelpSubmenu(): MenuItemConstructorOptions[] {
  return buildHelpSubmenu()
}
