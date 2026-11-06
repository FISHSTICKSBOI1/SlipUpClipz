import { app, type BrowserWindow } from 'electron'
import type { LicenseSnapshot, LicenseState } from '../shared/appTypes.js'
import { shouldAcceptDevDemoKey } from './licenseDevDemo.js'
import {
  advanceObservedTime,
  buildActivatedLicense,
  buildFreeLicense,
  isLicenseKeyFormat,
  isProLicenseState,
  keepsStoredLicenseWhenValidationFails,
  needsMandatoryRevalidation,
  normalizeLicenseKey,
  redactLicenseKey,
  resolveLicenseAccess,
  shouldRevalidate,
} from './licenseLogic.js'
import { getInstalledDeviceId } from './deviceId.js'
import { LICENSE_REVALIDATION_INTERVAL_MS, assertLicenseEndpointSecure, licenseFunctionUrl } from './licenseConfig.js'
import { validateLicenseWithServer } from './licenseServer.js'
import { getLicense, getSettings, setLicense } from './store.js'
import { syncGlobalHotkeys } from './hotkeys.js'

type ActivateResult =
  | { ok: true; license: LicenseState }
  | { ok: false; error: string }

let refreshTimer: ReturnType<typeof setInterval> | null = null
let getMainWindowRef: (() => BrowserWindow | null) | null = null

export function currentLicenseSnapshot(): LicenseSnapshot {
  const license = getLicense()
  const resolved = resolveLicenseAccess({
    isPackaged: app.isPackaged,
    devProTesting: getSettings().devProTesting === true,
    license,
  })
  return {
    license,
    isPro: resolved.isPro,
    access: resolved.access,
    developmentBuild: app.isPackaged !== true,
  }
}

function notifyLicenseChanged(): void {
  const window = getMainWindowRef?.()
  if (window && !window.isDestroyed()) {
    window.webContents.send('license:changed', currentLicenseSnapshot())
  }
}

export function publishLicenseState(): void {
  notifyLicenseChanged()
}

function applyLicenseState(license: LicenseState): LicenseState {
  const saved = setLicense(license)
  notifyLicenseChanged()
  return saved
}

export function isProLicense(license: LicenseState): boolean {
  return resolveLicenseAccess({
    isPackaged: app.isPackaged,
    devProTesting: getSettings().devProTesting === true,
    license,
  }).isPro
}

export function deactivateLicense(): LicenseState {
  return buildFreeLicense()
}

async function postLicenseFunction(
  functionName: string,
  body: Record<string, string>,
): Promise<{ ok: boolean; payload: Record<string, unknown> | null }> {
  const endpoint = licenseFunctionUrl(app.isPackaged, functionName)
  try {
    assertLicenseEndpointSecure(endpoint, app.isPackaged)
  } catch {
    return { ok: false, payload: null }
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    return { ok: response.ok, payload }
  } catch {
    return { ok: false, payload: null }
  }
}

export async function releaseStoredLicense(): Promise<{ warning?: string }> {
  const stored = getLicense()
  if (!stored.key || stored.devDemo === true) return {}

  const result = await postLicenseFunction('release-license', {
    licenseKey: stored.key,
    deviceId: getInstalledDeviceId(),
  })
  if (!result.ok) {
    return {
      warning:
        'The license was removed from this PC, but the server could not be reached. This computer may still hold the license until it is online, or until you transfer it from the new computer with the purchase email. Saved clips were kept.',
    }
  }
  return {}
}

export async function requestDeviceTransfer(input: {
  licenseKey: string
  email: string
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const result = await postLicenseFunction('device-transfer', {
    licenseKey: normalizeLicenseKey(input.licenseKey),
    email: input.email.trim(),
    deviceId: getInstalledDeviceId(),
  })
  if (!result.ok || result.payload?.ok === false) {
    const error =
      typeof result.payload?.error === 'string'
        ? result.payload.error
        : 'Could not send a transfer code. Try again.'
    return { ok: false, error }
  }
  return {
    ok: true,
    message:
      typeof result.payload?.message === 'string'
        ? result.payload.message
        : 'If that email matches this license, we sent a transfer code that expires in 60 minutes.',
  }
}

export async function confirmDeviceTransfer(input: {
  licenseKey: string
  code: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await postLicenseFunction('device-transfer-confirm', {
    licenseKey: normalizeLicenseKey(input.licenseKey),
    code: input.code.trim(),
    deviceId: getInstalledDeviceId(),
  })
  if (!result.ok || result.payload?.ok === false) {
    const error =
      typeof result.payload?.error === 'string'
        ? result.payload.error
        : 'This transfer code is invalid or expired.'
    return { ok: false, error }
  }
  return { ok: true }
}

export async function activateLicense(key: string): Promise<ActivateResult> {
  const normalized = normalizeLicenseKey(key)

  if (!isLicenseKeyFormat(normalized)) {
    return { ok: false, error: 'Invalid license key.' }
  }

  // Checksum demo keys are not in the license database. Accept them only in an
  // unpackaged build, and do it before the server call. The development app
  // targets localhost:8888, so a connection failure would otherwise hide them.
  // Packaged builds never take this branch.
  if (shouldAcceptDevDemoKey(app.isPackaged, normalized)) {
    console.info('[license] Activated development demo key', redactLicenseKey(normalized))
    return {
      ok: true,
      license: {
        ...buildActivatedLicense(normalized, null),
        devDemo: true,
      },
    }
  }

  // Production / Stripe-issued keys must be verified by the server.
  // Never accept an unverified key, and never use checksum activation when packaged.
  const serverResult = await validateLicenseWithServer(normalized)
  if (serverResult.ok) {
    return { ok: true, license: serverResult.license }
  }

  return { ok: false, error: serverResult.message }
}

async function refreshStoredLicense(options?: { force?: boolean }): Promise<void> {
  const stored = advanceObservedTime(getLicense())
  if (stored.latestObservedAt !== getLicense().latestObservedAt && stored.activated) {
    applyLicenseState(stored)
  }
  if (stored.devDemo === true) {
    if (app.isPackaged) {
      applyLicenseState(deactivateLicense())
      syncGlobalHotkeys(getMainWindowRef?.() ?? null, [])
      console.info('[license] Cleared a development demo key in a packaged build')
    }
    return
  }

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
    const serverNow = Date.parse(result.response.serverNow ?? '')
    const next = applyLicenseState({
      ...stored,
      ...result.license,
      activatedAt: stored.activatedAt ?? result.license.activatedAt,
      expiresAt: result.license.expiresAt,
      latestObservedAt: Math.max(
        Date.now(),
        Number.isFinite(serverNow) ? serverNow : 0,
        result.license.latestObservedAt ?? 0,
      ),
    })
    console.info('[license] Revalidated', redactLicenseKey(next.key ?? stored.key))
    return
  }

  if (keepsStoredLicenseWhenValidationFails(result.errorCode)) {
    console.info(
      '[license] Validation unavailable. Saved license kept for',
      redactLicenseKey(stored.key),
    )
    return
  }

  const cleared = applyLicenseState(deactivateLicense())
  syncGlobalHotkeys(getMainWindowRef?.() ?? null, [])
  console.info(
    '[license] Server rejected stored license; Pro disabled for',
    redactLicenseKey(cleared.key ?? stored.key),
  )
}

/** Recheck the saved license with the server before a large Voice Cloning download. */
export async function revalidateStoredLicenseBeforeDownload(): Promise<void> {
  await refreshStoredLicense({ force: true })
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
