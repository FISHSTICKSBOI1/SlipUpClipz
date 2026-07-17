import { app, type BrowserWindow } from 'electron'
import type { LicenseState } from '../shared/appTypes.js'
import { isDevDemoLicenseKey } from './licenseDevDemo.js'
import {
  buildActivatedLicense,
  buildFreeLicense,
  isLicenseKeyFormat,
  isProLicenseState,
  needsMandatoryRevalidation,
  normalizeLicenseKey,
  redactLicenseKey,
  shouldRevalidate,
} from './licenseLogic.js'
import { validateLicenseWithServer } from './licenseServer.js'
import { LICENSE_REVALIDATION_INTERVAL_MS } from './licenseConfig.js'
import { getLicense, setLicense } from './store.js'
import { syncGlobalHotkeys } from './hotkeys.js'

type ActivateResult =
  | { ok: true; license: LicenseState }
  | { ok: false; error: string }

let refreshTimer: ReturnType<typeof setInterval> | null = null
let getMainWindowRef: (() => BrowserWindow | null) | null = null

function notifyLicenseChanged(license: LicenseState): void {
  const window = getMainWindowRef?.()
  if (window && !window.isDestroyed()) {
    window.webContents.send('license:changed', license)
  }
}

function applyLicenseState(license: LicenseState): LicenseState {
  const saved = setLicense(license)
  notifyLicenseChanged(saved)
  return saved
}

export function isProLicense(license: LicenseState): boolean {
  return isProLicenseState(license)
}

export function deactivateLicense(): LicenseState {
  return buildFreeLicense()
}

export async function activateLicense(key: string): Promise<ActivateResult> {
  const normalized = normalizeLicenseKey(key)

  if (!isLicenseKeyFormat(normalized)) {
    return { ok: false, error: 'Invalid license key.' }
  }

  const serverResult = await validateLicenseWithServer(normalized)
  if (serverResult.ok) {
    return { ok: true, license: serverResult.license }
  }

  if (
    serverResult.errorCode === 'network' ||
    serverResult.errorCode === 'timeout' ||
    serverResult.errorCode === 'server_error' ||
    serverResult.errorCode === 'malformed_response'
  ) {
    return { ok: false, error: serverResult.message }
  }

  if (!app.isPackaged && isDevDemoLicenseKey(normalized)) {
    console.info('[license] Activated development demo key', redactLicenseKey(normalized))
    return {
      ok: true,
      license: buildActivatedLicense(normalized, null),
    }
  }

  return { ok: false, error: serverResult.message }
}

async function refreshStoredLicense(options?: { force?: boolean }): Promise<void> {
  const stored = getLicense()
  if (!stored.key || !stored.activated || stored.tier !== 'pro') {
    return
  }

  const mustRevalidate =
    options?.force === true ||
    needsMandatoryRevalidation(stored) ||
    shouldRevalidate(stored.lastValidatedAt)

  if (!mustRevalidate) {
    if (!isProLicenseState(stored)) {
      console.info(
        '[license] Local grace or expiry elapsed; Pro disabled for',
        redactLicenseKey(stored.key),
      )
      applyLicenseState(deactivateLicense())
      syncGlobalHotkeys(getMainWindowRef?.() ?? null, [])
    }
    return
  }

  const result = await validateLicenseWithServer(stored.key)

  if (result.ok) {
    const next = applyLicenseState({
      ...stored,
      ...result.license,
      activatedAt: stored.activatedAt ?? result.license.activatedAt,
    })
    console.info('[license] Revalidated', redactLicenseKey(next.key ?? stored.key))
    return
  }

  if (
    result.errorCode === 'network' ||
    result.errorCode === 'timeout' ||
    result.errorCode === 'server_error' ||
    result.errorCode === 'malformed_response'
  ) {
    if (needsMandatoryRevalidation(stored)) {
      const cleared = applyLicenseState(deactivateLicense())
      syncGlobalHotkeys(getMainWindowRef?.() ?? null, [])
      console.info(
        '[license] Offline grace expired and validation unavailable; Pro disabled for',
        redactLicenseKey(cleared.key ?? stored.key),
      )
    }
    return
  }

  const cleared = applyLicenseState(deactivateLicense())
  syncGlobalHotkeys(getMainWindowRef?.() ?? null, [])
  console.info(
    '[license] Server rejected stored license; Pro disabled for',
    redactLicenseKey(cleared.key ?? stored.key),
  )
}

export function initializeLicenseValidation(getMainWindow: () => BrowserWindow | null): void {
  getMainWindowRef = getMainWindow

  void refreshStoredLicense({ force: true })

  if (refreshTimer) {
    clearInterval(refreshTimer)
  }

  refreshTimer = setInterval(() => {
    void refreshStoredLicense()
  }, LICENSE_REVALIDATION_INTERVAL_MS)
}

export function shutdownLicenseValidation(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}
