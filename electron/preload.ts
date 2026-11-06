import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  HotkeyBinding,
  LicenseSnapshot,
} from '../shared/appTypes.js'

export type SettingsPatch = Partial<AppSettings>

export type LicenseGetResult = LicenseSnapshot

export type LicenseActivateResult =
  | ({ ok: true } & LicenseSnapshot)
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

export type AiComponentView = {
  status: 'missing' | 'installing' | 'installed' | 'failed'
  distribution: 'website' | 'microsoft-store'
  progressPercent: number | null
  stage: string | null
  error: string | null
  canDownload: boolean
  canChooseFile: boolean
  requiresPro: boolean
  setupUnavailable: boolean
  updateAvailable: boolean
  runtime: 'missing' | 'ready' | 'update' | 'repair'
  downloadBytes: number
  requiredFreeBytes: number
}

type UpdateState = {
  status: UpdateStatus
  currentVersion: string
  availableVersion: string | null
  progressPercent: number | null
  error: string | null
  canInstall: boolean
  distribution?: 'github' | 'microsoft-store'
}

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  ai: {
    health: (): Promise<{ ready: boolean; message?: string }> => ipcRenderer.invoke('ai:health'),
    transcribe: (payload: { audioWav: Uint8Array; consent: boolean }): Promise<{ text: string; noSpeech: boolean; unclear: boolean; truncated: boolean }> =>
      ipcRenderer.invoke('ai:transcribe', payload),
    generate: (payload: { audioWav: Uint8Array; refText: string; text: string; temporary?: boolean; sessionId?: string; consent: boolean; requestId?: string }): Promise<Uint8Array> =>
      ipcRenderer.invoke('ai:generate', payload),
    onGenerateProgress: (callback: (event: { requestId: string; stage: 'loading' | 'generating' | 'finishing' }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, next: { requestId: string; stage: 'loading' | 'generating' | 'finishing' }) => {
        callback(next)
      }
      ipcRenderer.on('ai:generate-progress', listener)
      return () => {
        ipcRenderer.removeListener('ai:generate-progress', listener)
      }
    },
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    set: (partial: SettingsPatch): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:set', partial),
  },

  clips: {
    authorizeRemoveSelection: (): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke('clips:authorizeRemoveSelection'),
  },

  license: {
    get: (): Promise<LicenseGetResult> => ipcRenderer.invoke('license:get'),
    activate: (key: string): Promise<LicenseActivateResult> =>
      ipcRenderer.invoke('license:activate', key),
    deactivate: (): Promise<LicenseActivateResult & { warning?: string }> =>
      ipcRenderer.invoke('license:deactivate'),
    requestTransfer: (payload: { licenseKey: string; email: string }): Promise<{ ok: boolean; message?: string; error?: string }> =>
      ipcRenderer.invoke('license:request-transfer', payload),
    confirmTransfer: (payload: { licenseKey: string; code: string }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('license:confirm-transfer', payload),
    openBillingPortal: (payload: { licenseKey: string; email: string }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('license:open-billing-portal', payload),
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

  aiComponent: {
    getState: (): Promise<AiComponentView> => ipcRenderer.invoke('ai-component:getState'),
    download: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('ai-component:download'),
    cancel: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('ai-component:cancel'),
    chooseFile: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('ai-component:choose-file'),
    onStateChange: (callback: (state: AiComponentView) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, next: AiComponentView) => {
        callback(next)
      }
      ipcRenderer.on('ai-component:state', listener)
      return () => {
        ipcRenderer.removeListener('ai-component:state', listener)
      }
    },
  },

  updater: {
    getState: (): Promise<UpdateState> => ipcRenderer.invoke('updater:getState'),
    check: (): Promise<UpdateState> => ipcRenderer.invoke('updater:check'),
    install: (): Promise<void> => ipcRenderer.invoke('updater:install'),
    openStore: (): Promise<void> => ipcRenderer.invoke('updater:open-store'),
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
    setModalScrim: (active: boolean, opacity?: number): Promise<void> =>
      ipcRenderer.invoke('window:setModalScrim', active, opacity),
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

  onLicenseChanged: (callback: (snapshot: LicenseSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: LicenseSnapshot) => {
      callback(snapshot)
    }
    ipcRenderer.on('license:changed', listener)
    return () => {
      ipcRenderer.removeListener('license:changed', listener)
    }
  },
})
