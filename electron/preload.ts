import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  HotkeyBinding,
  LicenseState,
} from '../shared/appTypes.js'

export type SettingsPatch = Partial<AppSettings>

export type LicenseGetResult = {
  license: LicenseState
  isPro: boolean
}

export type LicenseActivateResult =
  | { ok: true; license: LicenseState; isPro: boolean }
  | { ok: false; error: string }

export type HotkeySyncResult = {
  registered: number
  failed: string[]
}

export type UpdateStatus =
  | 'idle'
  | 'up-to-date'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'failed'

export type UpdateState = {
  status: UpdateStatus
  currentVersion: string
  availableVersion: string | null
  progressPercent: number | null
  error: string | null
  canInstall: boolean
}

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    set: (partial: SettingsPatch): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:set', partial),
  },

  license: {
    get: (): Promise<LicenseGetResult> => ipcRenderer.invoke('license:get'),
    activate: (key: string): Promise<LicenseActivateResult> =>
      ipcRenderer.invoke('license:activate', key),
    deactivate: (): Promise<LicenseActivateResult> =>
      ipcRenderer.invoke('license:deactivate'),
  },

  hotkeys: {
    sync: (bindings: HotkeyBinding[]): Promise<HotkeySyncResult> =>
      ipcRenderer.invoke('hotkeys:sync', bindings),
  },

  app: {
    getVersion: (): Promise<{ version: string; platform: NodeJS.Platform }> =>
      ipcRenderer.invoke('app:getVersion'),
    getLoginItemSettings: (): Promise<{ openAtLogin: boolean }> =>
      ipcRenderer.invoke('app:getLoginItemSettings'),
  },

  updater: {
    getState: (): Promise<UpdateState> => ipcRenderer.invoke('updater:getState'),
    check: (): Promise<UpdateState> => ipcRenderer.invoke('updater:check'),
    install: (): Promise<void> => ipcRenderer.invoke('updater:install'),
    onStateChange: (callback: (state: UpdateState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, next: UpdateState) => {
        callback(next)
      }
      ipcRenderer.on('updater:state', listener)
      return () => {
        ipcRenderer.removeListener('updater:state', listener)
      }
    },
  },

  shell: {
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke('shell:openExternal', url),
  },

  onTrayCommand: (callback: (command: 'toggle-replay-buffer') => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      command: 'toggle-replay-buffer',
    ) => {
      callback(command)
    }
    ipcRenderer.on('tray:command', listener)
    return () => {
      ipcRenderer.removeListener('tray:command', listener)
    }
  },

  window: {
    show: (): Promise<void> => ipcRenderer.invoke('window:show'),
    hide: (): Promise<void> => ipcRenderer.invoke('window:hide'),
    maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    unmaximize: (): Promise<void> => ipcRenderer.invoke('window:unmaximize'),
    toggleMaximize: (): Promise<{ isMaximized: boolean }> =>
      ipcRenderer.invoke('window:toggleMaximize'),
    toggleFullScreen: (): Promise<{ isFullScreen: boolean }> =>
      ipcRenderer.invoke('window:toggleFullScreen'),
    getState: (): Promise<{ isMaximized: boolean; isFullScreen: boolean }> =>
      ipcRenderer.invoke('window:getState'),
    onStateChange: (
      callback: (state: { isMaximized: boolean; isFullScreen: boolean }) => void,
    ) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        state: { isMaximized: boolean; isFullScreen: boolean },
      ) => {
        callback(state)
      }
      ipcRenderer.on('window:state', listener)
      return () => {
        ipcRenderer.removeListener('window:state', listener)
      }
    },
  },

  recorder: {
    setStatus: (status: { isListening: boolean }): Promise<void> =>
      ipcRenderer.invoke('recorder:setStatus', status),
    notify: (payload: { title: string; body: string }): Promise<void> =>
      ipcRenderer.invoke('recorder:notify', payload),
    registerClipHotkey: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('recorder:registerClipHotkey'),
  },

  systemAudio: {
    getCapabilities: (): Promise<{ loopbackSupported: boolean; platform: NodeJS.Platform }> =>
      ipcRenderer.invoke('systemAudio:getCapabilities'),
    enableLoopback: (): Promise<void> => ipcRenderer.invoke('systemAudio:enableLoopback'),
    disableLoopback: (): Promise<void> => ipcRenderer.invoke('systemAudio:disableLoopback'),
  },

  captureNotification: {
    show: (): Promise<void> => ipcRenderer.invoke('capture-notification:show'),
  },

  onHotkeyTrigger: (callback: (clipId: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, clipId: string) => {
      callback(clipId)
    }
    ipcRenderer.on('hotkey:trigger', listener)
    return () => {
      ipcRenderer.removeListener('hotkey:trigger', listener)
    }
  },

  onClipHotkeyTrigger: (callback: () => void) => {
    const listener = () => {
      callback()
    }
    ipcRenderer.on('recorder:clipTriggered', listener)
    return () => {
      ipcRenderer.removeListener('recorder:clipTriggered', listener)
    }
  },

  onLicenseChanged: (callback: (license: LicenseState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, license: LicenseState) => {
      callback(license)
    }
    ipcRenderer.on('license:changed', listener)
    return () => {
      ipcRenderer.removeListener('license:changed', listener)
    }
  },
})
