/// <reference types="vite/client" />

import type {
  AppSettings,
  HotkeyBinding,
  LicenseState,
  ReplayAudioSource,
} from '@shared/appTypes'

type SettingsPatch = Partial<AppSettings>

type UpdateStatus =
  | 'idle'
  | 'up-to-date'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'failed'

type UpdateState = {
  status: UpdateStatus
  currentVersion: string
  availableVersion: string | null
  progressPercent: number | null
  error: string | null
  canInstall: boolean
}

type LicenseGetResult = {
  license: LicenseState
  isPro: boolean
}

type LicenseActivateResult =
  | { ok: true; license: LicenseState; isPro: boolean }
  | { ok: false; error: string }

type HotkeySyncResult = {
  registered: number
  failed: string[]
}

interface ElectronAPI {
  isElectron: boolean
  platform: NodeJS.Platform
  settings: {
    get: () => Promise<AppSettings>
    set: (partial: SettingsPatch) => Promise<AppSettings>
  }
  license: {
    get: () => Promise<LicenseGetResult>
    activate: (key: string) => Promise<LicenseActivateResult>
    deactivate: () => Promise<LicenseActivateResult>
  }
  hotkeys: {
    sync: (bindings: HotkeyBinding[]) => Promise<HotkeySyncResult>
  }
  app: {
    getVersion: () => Promise<{ version: string; platform: NodeJS.Platform }>
    getLoginItemSettings: () => Promise<{ openAtLogin: boolean }>
  }
  updater: {
    getState: () => Promise<UpdateState>
    check: () => Promise<UpdateState>
    install: () => Promise<void>
    onStateChange: (callback: (state: UpdateState) => void) => () => void
  }
  shell: {
    openExternal: (url: string) => Promise<void>
  }
  window: {
    show: () => Promise<void>
    hide: () => Promise<void>
    maximize: () => Promise<void>
    unmaximize: () => Promise<void>
    toggleMaximize: () => Promise<{ isMaximized: boolean }>
    toggleFullScreen: () => Promise<{ isFullScreen: boolean }>
    getState: () => Promise<{ isMaximized: boolean; isFullScreen: boolean }>
    onStateChange: (
      callback: (state: { isMaximized: boolean; isFullScreen: boolean }) => void,
    ) => () => void
  }
  recorder: {
    setStatus: (status: { isListening: boolean }) => Promise<void>
    notify: (payload: { title: string; body: string }) => Promise<void>
    registerClipHotkey: () => Promise<{ ok: boolean }>
  }
  captureNotification: {
    show: () => Promise<void>
  }
  systemAudio: {
    getCapabilities: () => Promise<{ loopbackSupported: boolean; platform: NodeJS.Platform }>
    enableLoopback: () => Promise<void>
    disableLoopback: () => Promise<void>
  }
  onHotkeyTrigger: (callback: (clipId: string) => void) => () => void
  onClipHotkeyTrigger: (callback: () => void) => () => void
  onLicenseChanged: (callback: (license: LicenseState) => void) => () => void
  onTrayCommand: (callback: (command: 'toggle-replay-buffer') => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

declare module '*.mp3' {
  const src: string
  export default src
}

export type { ReplayAudioSource }
