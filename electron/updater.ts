import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { getDisplayedAppVersion } from './appVersion.js'
import {
  githubNsisUpdatesAllowed,
  isNewerRelease,
  MICROSOFT_STORE_LISTING_URL,
  updateDistribution,
} from '../shared/updateChannel.js'

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
  distribution?: 'github' | 'microsoft-store'
}

type GetMainWindow = () => BrowserWindow | null

let getMainWindow: GetMainWindow = () => null
let updateReady = false
let promptShownForVersion: string | null = null
let checking = false

let state: UpdateState = {
  status: 'idle',
  currentVersion: getDisplayedAppVersion(),
  availableVersion: null,
  progressPercent: null,
  error: null,
  canInstall: false,
  distribution: 'github',
}

function broadcastState(): void {
  const window = getMainWindow()
  if (!window || window.isDestroyed()) return
  window.webContents.send('updater:state', state)
}

function setState(partial: Partial<UpdateState>): void {
  state = {
    ...state,
    currentVersion: getDisplayedAppVersion(),
    ...partial,
    canInstall: partial.canInstall ?? (updateReady || state.canInstall),
  }
  broadcastState()
}

function showUpdateReadyPrompt(version: string): void {
  if (promptShownForVersion === version) return
  promptShownForVersion = version

  void dialog
    .showMessageBox({
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: 'A SlipUpClipz update is ready. Restart now to install?',
      detail: `Version ${version} has been downloaded. Choose Later to keep using the app and install from Settings when you are ready.`,
    })
    .then(({ response }) => {
      if (response === 0) {
        quitAndInstallUpdate()
      }
    })
}

export function quitAndInstallUpdate(): void {
  const distribution = updateDistribution({
    packaged: app.isPackaged,
    windowsStore: process.windowsStore,
    execPath: process.execPath,
  })
  if (!githubNsisUpdatesAllowed(distribution)) {
    console.warn('[autoUpdater] quitAndInstall ignored for this installation')
    return
  }

  try {
    // isSilent=false, isForceRunAfter=true — install and relaunch.
    autoUpdater.quitAndInstall(false, true)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[autoUpdater] quitAndInstall failed:', message)
    setState({
      status: 'failed',
      error: message,
      canInstall: true,
    })
  }
}

async function runUpdateCheck(manual: boolean): Promise<UpdateState> {
  const distribution = updateDistribution({
    packaged: app.isPackaged,
    windowsStore: process.windowsStore,
    execPath: process.execPath,
  })
  if (distribution === 'microsoft-store') {
    return storeManagedState()
  }
  if (distribution === 'unpackaged') {
    setState({
      status: 'up-to-date',
      availableVersion: null,
      progressPercent: null,
      error: null,
      canInstall: false,
    })
    return state
  }

  if (checking) {
    return state
  }

  checking = true
  setState({
    status: 'checking',
    error: null,
    progressPercent: null,
  })

  try {
    const result = await autoUpdater.checkForUpdates()
    if (!result) {
      setState({
        status: 'up-to-date',
        availableVersion: null,
      })
      return state
    }

    // If nothing newer is available, electron-updater still resolves.
    // Status is refined by the update-not-available / update-available handlers.
    if (manual && state.status === 'checking') {
      // Give event handlers a tick to settle.
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    return state
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[autoUpdater] checkForUpdates failed:', message)
    setState({
      status: 'failed',
      error: message,
      progressPercent: null,
    })
    return state
  } finally {
    checking = false
  }
}

function storeManagedState(): UpdateState {
  setState({
    status: 'up-to-date',
    availableVersion: null,
    progressPercent: null,
    error: null,
    canInstall: false,
    distribution: 'microsoft-store',
  })
  return state
}

function wireAutoUpdaterEvents(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    setState({
      status: 'checking',
      error: null,
      progressPercent: null,
    })
  })

  autoUpdater.on('update-available', (info) => {
    if (!isNewerRelease(getDisplayedAppVersion(), info.version)) {
      console.info(`[autoUpdater] Ignoring ${info.version}; it is not newer than ${getDisplayedAppVersion()}`)
      updateReady = false
      setState({
        status: 'up-to-date',
        availableVersion: null,
        progressPercent: null,
        canInstall: false,
      })
      return
    }
    console.info(`[autoUpdater] Update available: ${info.version} (current ${getDisplayedAppVersion()})`)
    setState({
      status: 'available',
      availableVersion: info.version,
      error: null,
      progressPercent: 0,
      distribution: 'github',
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    console.info(`[autoUpdater] Up to date (checked ${info.version}, current ${getDisplayedAppVersion()})`)
    updateReady = false
    setState({
      status: 'up-to-date',
      availableVersion: null,
      progressPercent: null,
      error: null,
      canInstall: false,
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.max(0, Math.min(100, Math.round(progress.percent)))
    setState({
      status: 'downloading',
      progressPercent: percent,
      error: null,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    if (!isNewerRelease(getDisplayedAppVersion(), info.version)) {
      updateReady = false
      setState({
        status: 'up-to-date',
        availableVersion: null,
        canInstall: false,
      })
      return
    }
    console.info(`[autoUpdater] Update downloaded: ${info.version}`)
    updateReady = true
    setState({
      status: 'ready',
      availableVersion: info.version,
      progressPercent: 100,
      error: null,
      canInstall: true,
    })
    showUpdateReadyPrompt(info.version)
  })

  autoUpdater.on('error', (error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[autoUpdater]', message)
    setState({
      status: 'failed',
      error: message,
      progressPercent: null,
    })
  })
}

export function registerUpdaterIpc(getWindow: GetMainWindow): void {
  getMainWindow = getWindow

  ipcMain.handle('updater:getState', () => {
    state = { ...state, currentVersion: getDisplayedAppVersion() }
    return state
  })

  ipcMain.handle('updater:check', async () => runUpdateCheck(true))

  ipcMain.handle('updater:install', () => {
    quitAndInstallUpdate()
  })

  ipcMain.handle('updater:open-store', async () => {
    await shell.openExternal(MICROSOFT_STORE_LISTING_URL)
  })
}

export function setupAutoUpdater(getWindow: GetMainWindow): void {
  getMainWindow = getWindow
  state = {
    ...state,
    currentVersion: getDisplayedAppVersion(),
  }

  const distribution = updateDistribution({
    packaged: app.isPackaged,
    windowsStore: process.windowsStore,
    execPath: process.execPath,
  })
  if (distribution === 'unpackaged') {
    console.info('[autoUpdater] Skipping updates in development (unpackaged build)')
    setState({
      status: 'up-to-date',
      canInstall: false,
      distribution: 'github',
    })
    return
  }

  // The published Store app is the MSIX family SlipUpClipzLLC.SlipUpClipz.
  // Windows Update replaces that package. Do not download the website NSIS installer.
  if (distribution === 'microsoft-store') {
    console.info('[autoUpdater] Microsoft Store package uses Store updates')
    storeManagedState()
    return
  }

  wireAutoUpdaterEvents()

  const window = getWindow()
  const startCheck = () => {
    void runUpdateCheck(false)
  }

  if (window && !window.isDestroyed()) {
    if (window.isVisible()) {
      startCheck()
    } else {
      window.once('ready-to-show', startCheck)
    }
  } else {
    // Fallback if the window is not ready yet.
    app.whenReady().then(() => {
      setTimeout(startCheck, 1500)
    })
  }
}
// setupAutoUpdater ends here.


