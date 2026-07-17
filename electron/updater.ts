import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

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

type GetMainWindow = () => BrowserWindow | null

let getMainWindow: GetMainWindow = () => null
let updateReady = false
let promptShownForVersion: string | null = null
let checking = false

let state: UpdateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: null,
  progressPercent: null,
  error: null,
  canInstall: false,
}

function broadcastState(): void {
  const window = getMainWindow()
  if (!window || window.isDestroyed()) return
  window.webContents.send('updater:state', state)
}

function setState(partial: Partial<UpdateState>): void {
  state = {
    ...state,
    currentVersion: app.getVersion(),
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
  if (!app.isPackaged) {
    console.warn('[autoUpdater] quitAndInstall ignored in development')
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
  if (!app.isPackaged) {
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

function wireAutoUpdaterEvents(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    setState({
      status: 'checking',
      error: null,
      progressPercent: null,
    })
  })

  autoUpdater.on('update-available', (info) => {
    console.info(`[autoUpdater] Update available: ${info.version} (current ${app.getVersion()})`)
    setState({
      status: 'available',
      availableVersion: info.version,
      error: null,
      progressPercent: 0,
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    console.info(`[autoUpdater] Up to date (checked ${info.version}, current ${app.getVersion()})`)
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
    state = { ...state, currentVersion: app.getVersion() }
    return state
  })

  ipcMain.handle('updater:check', async () => runUpdateCheck(true))

  ipcMain.handle('updater:install', () => {
    quitAndInstallUpdate()
  })
}

export function setupAutoUpdater(getWindow: GetMainWindow): void {
  getMainWindow = getWindow
  state = {
    ...state,
    currentVersion: app.getVersion(),
  }

  if (!app.isPackaged) {
    console.info('[autoUpdater] Skipping updates in development (unpackaged build)')
    setState({
      status: 'up-to-date',
      canInstall: false,
    })
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
