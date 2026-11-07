/// <reference types="vite/client" />

import type {
  AppSettings,
  HotkeyBinding,
  LicenseSnapshot,
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

type AiComponentView = {
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

type LicenseGetResult = LicenseSnapshot

type LicenseActivateResult =
  | ({ ok: true } & LicenseSnapshot)
  | { ok: false; error: string }

type HotkeySyncResult = {
  registered: number
  failed: string[]
}

interface ElectronAPI {
  isElectron: boolean
  platform: NodeJS.Platform
  ai: {
    health: () => Promise<{ ready: boolean; message?: string }>
    transcribe: (payload: { audioWav: Uint8Array; consent: boolean }) => Promise<{ text: string; noSpeech: boolean; unclear: boolean; truncated: boolean }>
    generate: (payload: { audioWav: Uint8Array; refText: string; text: string; temporary?: boolean; sessionId?: string; consent: boolean; requestId?: string }) => Promise<Uint8Array>
    restart: () => Promise<{ ok: true } | { ok: false; code: 'busy' | 'foreign' | 'failed'; message: string }>
    cancel: (payload: { requestId: string; sessionId?: string }) => Promise<{ stopped: boolean; message?: string }>
    onGenerateProgress: (callback: (event: { requestId: string; stage: 'loading' | 'generating' | 'finishing' }) => void) => () => void
  }
  settings: {
    get: () => Promise<AppSettings>
    set: (partial: SettingsPatch) => Promise<AppSettings>
  }
  clips: {
    authorizeRemoveSelection: () => Promise<{ ok: true } | { ok: false; error: string }>
  }
  license: {
    get: () => Promise<LicenseGetResult>
    activate: (key: string) => Promise<LicenseActivateResult>
    deactivate: () => Promise<LicenseActivateResult & { warning?: string }>
    requestTransfer: (payload: { licenseKey: string; email: string }) => Promise<{ ok: boolean; message?: string; error?: string }>
    confirmTransfer: (payload: { licenseKey: string; code: string }) => Promise<{ ok: boolean; error?: string }>
    requestTransfer: (payload: { licenseKey: string; email: string }) => Promise<{ ok: boolean; message?: string; error?: string }>
    confirmTransfer: (payload: { licenseKey: string; code: string }) => Promise<{ ok: boolean; error?: string }>
    openBillingPortal: (payload: { licenseKey: string; email: string }) => Promise<{ ok: boolean; error?: string }>
  }
  hotkeys: {
    sync: (bindings: HotkeyBinding[]) => Promise<HotkeySyncResult>
  }
  app: {
    getVersion: () => Promise<{ version: string; platform: NodeJS.Platform }>
    getLoginItemSettings: () => Promise<{ openAtLogin: boolean }>
  }
  aiComponent: {
    getState: () => Promise<AiComponentView>
    download: () => Promise<{ ok: boolean; error?: string }>
    cancel: () => Promise<{ ok: boolean; error?: string }>
    chooseFile: () => Promise<{ ok: boolean; error?: string }>
    onStateChange: (callback: (state: AiComponentView) => void) => () => void
  }
  updater: {
    getState: () => Promise<UpdateState>
    openStore: () => Promise<void>
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
    setModalScrim: (active: boolean, opacity?: number) => Promise<void>
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
  onLicenseChanged: (callback: (snapshot: LicenseSnapshot) => void) => () => void
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
