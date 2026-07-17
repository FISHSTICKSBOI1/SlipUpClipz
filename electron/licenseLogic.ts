import type { LicenseState } from '../shared/appTypes.js'
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

  return {
    valid: payload.valid,
    tier: payload.tier,
    expiresAt,
    status,
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
    status === 'missing_subscription'
  ) {
    return 'Subscription inactive.'
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
    return false
  }

  const expiresMs = Date.parse(expiresAt)
  return Number.isFinite(expiresMs) && expiresMs <= now
}

export function isProLicenseState(license: LicenseState, now = Date.now()): boolean {
  if (!license.activated || license.tier !== 'pro') {
    return false
  }

  if (isExpirationPast(license.expiresAt, now)) {
    return false
  }

  return isWithinOfflineGrace(license.lastValidatedAt, now)
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

export function buildFreeLicense(): LicenseState {
  return {
    activated: false,
    tier: 'free',
  }
}

export function canUseDevDemoFallback(isPackaged: boolean): boolean {
  return !isPackaged
}
