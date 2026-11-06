import type { LicenseAccess, LicenseState } from '../shared/appTypes.js'
import {
  LICENSE_OFFLINE_GRACE_MS,
  LICENSE_REVALIDATION_INTERVAL_MS,
} from './licenseConfig.js'

export const LICENSE_KEY_PATTERN = /^SLIP-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/i

export type ServerValidationPayload = {
  valid: boolean
  tier: 'pro' | 'free'
  expiresAt?: string | null
  status?: string | null
  serverNow?: string | null
}

export function normalizeLicenseKey(key: string): string {
  return key.trim().toUpperCase()
}

export function isLicenseKeyFormat(key: string): boolean {
  return LICENSE_KEY_PATTERN.test(normalizeLicenseKey(key))
}

export function redactLicenseKey(key: string): string {
  const normalized = normalizeLicenseKey(key)
  const match = normalized.match(LICENSE_KEY_PATTERN)
  if (!match) {
    return 'SLIP-****-****-****'
  }

  return `SLIP-****-****-${match[3]}`
}

export function parseServerValidationPayload(data: unknown): ServerValidationPayload | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const payload = data as Record<string, unknown>
  if (typeof payload.valid !== 'boolean' || (payload.tier !== 'pro' && payload.tier !== 'free')) {
    return null
  }

  const expiresAt =
    payload.expiresAt === null || typeof payload.expiresAt === 'string'
      ? (payload.expiresAt as string | null)
      : undefined

  const status =
    payload.status === null || typeof payload.status === 'string'
      ? (payload.status as string | null)
      : undefined

  const serverNow = typeof payload.serverNow === 'string' ? payload.serverNow : undefined

  return {
    valid: payload.valid,
    tier: payload.tier,
    expiresAt,
    status,
    ...(serverNow ? { serverNow } : {}),
  }
}

export function mapValidationFailureMessage(
  status?: string | null,
  expiresAt?: string | null,
): string {
  if (status === 'expired') {
    return 'License expired.'
  }

  if (expiresAt) {
    const expiresMs = Date.parse(expiresAt)
    if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) {
      return 'License expired.'
    }
  }

  if (
    status === 'past_due' ||
    status === 'canceled' ||
    status === 'unpaid' ||
    status === 'refunded' ||
    status === 'disputed' ||
    status === 'revoked' ||
    status === 'missing_subscription' ||
    status === 'device_in_use' ||
    status === 'device_required'
  ) {
    if (status === 'device_in_use') {
      return 'This license is active on another computer. Remove it there, or transfer it with the purchase email.'
    }
    if (status === 'device_required') {
      return 'This app version cannot activate Pro. Install the current SlipUpClipz update and enter the same license key.'
    }
    return 'Subscription inactive.'
    return status === 'device_in_use'
      ? 'This license is active on another computer. Remove it there, or transfer it with the purchase email.'
      : 'Subscription inactive.'
  }

  return 'Invalid license key.'
}

export function isWithinOfflineGrace(
  lastValidatedAt: number | undefined,
  now = Date.now(),
): boolean {
  if (!lastValidatedAt) {
    return false
  }

  return now - lastValidatedAt <= LICENSE_OFFLINE_GRACE_MS
}

export function needsMandatoryRevalidation(
  license: LicenseState,
  now = Date.now(),
): boolean {
  if (!license.activated || license.tier !== 'pro') {
    return false
  }

  return !isWithinOfflineGrace(license.lastValidatedAt, now)
}

export function shouldRevalidate(
  lastValidatedAt: number | undefined,
  now = Date.now(),
): boolean {
  if (!lastValidatedAt) {
    return true
  }

  return now - lastValidatedAt >= LICENSE_REVALIDATION_INTERVAL_MS
}

export function isExpirationPast(
  expiresAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!expiresAt) {
    return true
  }

  const expiresMs = Date.parse(expiresAt)
  return !Number.isFinite(expiresMs) || expiresMs <= now
}

export function effectiveLicenseNow(license: LicenseState, now = Date.now()): number {
  const marks = [now]
  if (typeof license.latestObservedAt === 'number' && Number.isFinite(license.latestObservedAt)) {
    marks.push(license.latestObservedAt)
  }
  if (typeof license.lastValidatedAt === 'number' && Number.isFinite(license.lastValidatedAt)) {
    marks.push(license.lastValidatedAt)
  }
  return Math.max(...marks)
}

export function advanceObservedTime(license: LicenseState, now = Date.now()): LicenseState {
  const latestObservedAt = effectiveLicenseNow(license, now)
  if (latestObservedAt === license.latestObservedAt) {
    return license
  }
  return { ...license, latestObservedAt }
}

export function isProLicenseState(license: LicenseState, now = Date.now()): boolean {
  if (license.devDemo === true) {
    return false
  }

  if (!license.activated || license.tier !== 'pro') {
    return false
  }

  const effectiveNow = effectiveLicenseNow(license, now)
  if (isExpirationPast(license.expiresAt, effectiveNow)) {
    return false
  }

  return isWithinOfflineGrace(license.lastValidatedAt, effectiveNow)
}

export function activationTimestamp(serverNow: string | null | undefined): number | null {
  if (!serverNow) return null
  const parsed = Date.parse(serverNow)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Clock for a successful Pro check.
 * Prefer the JSON serverNow field. The deployed production function omits it,
 * so the HTTP Date header is the trusted clock instead. The computer's clock
 * is never used, because setting it forward would start the 24-hour allowance
 * in the future. Stripe still supplies the paid-period end.
 */
export function proValidationTimestamp(
  payload: { valid: boolean; tier: string; expiresAt?: string | null; serverNow?: string | null },
  trustedServerNow: number | null,
): number | null {
  if (!payload.valid || payload.tier !== 'pro') return null
  if (!payload.expiresAt || Number.isNaN(Date.parse(payload.expiresAt))) return null
  const fromBody = activationTimestamp(payload.serverNow)
  if (fromBody !== null) return fromBody
  return trustedServerNow !== null && Number.isFinite(trustedServerNow) ? trustedServerNow : null
}

export function buildActivatedLicense(
  key: string,
  expiresAt: string | null | undefined,
  now = Date.now(),
): LicenseState {
  return {
    activated: true,
    tier: 'pro',
    key: normalizeLicenseKey(key),
    activatedAt: now,
    expiresAt: expiresAt ?? null,
    lastValidatedAt: now,
  }
}

/** A missed license server must not delete a saved customer key. */
export function keepsStoredLicenseWhenValidationFails(errorCode: string): boolean {
  return (
    errorCode === 'network' ||
    errorCode === 'timeout' ||
    errorCode === 'server_error' ||
    errorCode === 'malformed_response'
  )
}

export function buildFreeLicense(): LicenseState {
  return {
    activated: false,
    tier: 'free',
  }
}

export function canUseDevDemoFallback(isPackaged: boolean): boolean {
  return !isPackaged
}

/**
 * Development Pro comes only from the local setting or a checksum demo key.
 * Packaged builds ignore that setting, environment variables, and argv.
 */
export function resolveLicenseAccess(input: {
  isPackaged: boolean
  devProTesting: boolean
  license: LicenseState
  now?: number
}): { isPro: boolean; access: LicenseAccess } {
  if (isProLicenseState(input.license, input.now)) {
    return { isPro: true, access: 'license' }
  }

  if (!input.isPackaged && (input.devProTesting === true || input.license.devDemo === true)) {
    return { isPro: true, access: 'development' }
  }

  return { isPro: false, access: 'free' }
}

export function developmentProEnabled(input: {
  isPackaged: boolean
  devProTesting: boolean
  env?: NodeJS.ProcessEnv
  argv?: readonly string[]
}): boolean {
  void input.env
  void input.argv
  if (input.isPackaged) return false
  return input.devProTesting === true
}
