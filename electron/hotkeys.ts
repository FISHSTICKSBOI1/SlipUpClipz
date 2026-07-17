import { globalShortcut } from 'electron'
import type { BrowserWindow } from 'electron'
import { CLIP_RECORD_ACCELERATOR, CLIP_RECORD_HOTKEY } from '../shared/appTypes.js'
import { isProLicense } from './license.js'
import { getLicense, getSettings, type HotkeyBinding } from './store.js'

const soundboardAccelerators = new Set<string>()
let clipHotkeyRegistered = false
let clipHotkeyAccelerator: string | null = null

export function hotkeyToAccelerator(hotkey: string): string {
  return hotkey
    .split('+')
    .map((part) => {
      if (part === 'Ctrl') return 'CommandOrControl'
      if (part === 'Meta') return 'Super'
      return part
    })
    .join('+')
}

export function getClipHotkeyAccelerator(): string {
  const settings = getSettings()
  const hotkey = settings.clipHotkey?.trim() || CLIP_RECORD_HOTKEY
  return hotkeyToAccelerator(hotkey)
}

function unregisterSoundboardHotkeys(): void {
  for (const accelerator of soundboardAccelerators) {
    globalShortcut.unregister(accelerator)
  }
  soundboardAccelerators.clear()
}

export function unregisterClipHotkey(): void {
  if (clipHotkeyRegistered && clipHotkeyAccelerator) {
    globalShortcut.unregister(clipHotkeyAccelerator)
    clipHotkeyRegistered = false
    clipHotkeyAccelerator = null
  }
}

export function registerClipHotkey(window: BrowserWindow | null): boolean {
  unregisterClipHotkey()

  if (!window || window.isDestroyed()) {
    return false
  }

  const accelerator = getClipHotkeyAccelerator()
  const success = globalShortcut.register(accelerator, () => {
    if (window.isDestroyed()) return
    // Background capture only — never show/focus/restore the main window.
    window.webContents.send('recorder:clipTriggered')
  })

  clipHotkeyRegistered = success
  clipHotkeyAccelerator = success ? accelerator : null
  return success
}

export function unregisterAllHotkeys(): void {
  unregisterClipHotkey()
  unregisterSoundboardHotkeys()
}

export function syncGlobalHotkeys(
  window: BrowserWindow | null,
  bindings: HotkeyBinding[],
): { registered: number; failed: string[] } {
  unregisterSoundboardHotkeys()

  const settings = getSettings()
  const license = getLicense()
  const clipAccelerator = getClipHotkeyAccelerator()

  if (!window || !settings.globalHotkeysEnabled || !isProLicense(license)) {
    return { registered: 0, failed: [] }
  }

  const failed: string[] = []
  let registered = 0

  for (const binding of bindings) {
    if (binding.accelerator === clipAccelerator || binding.accelerator === CLIP_RECORD_ACCELERATOR) {
      failed.push(binding.accelerator)
      continue
    }

    if (soundboardAccelerators.has(binding.accelerator)) {
      failed.push(binding.accelerator)
      continue
    }

    const success = globalShortcut.register(binding.accelerator, () => {
      if (!window.isDestroyed()) {
        window.webContents.send('hotkey:trigger', binding.clipId)
      }
    })

    if (success) {
      soundboardAccelerators.add(binding.accelerator)
      registered += 1
    } else {
      failed.push(binding.accelerator)
    }
  }

  return { registered, failed }
}
