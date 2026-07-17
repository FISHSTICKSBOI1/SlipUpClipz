import { app } from 'electron'
import type { LicenseState } from '../shared/appTypes.js'
import {
  assertLicenseEndpointSecure,
  getLicenseValidateUrl,
  LICENSE_REQUEST_TIMEOUT_MS,
} from './licenseConfig.js'
import {
  buildActivatedLicense,
  mapValidationFailureMessage,
  normalizeLicenseKey,
  parseServerValidationPayload,
  redactLicenseKey,
  type ServerValidationPayload,
} from './licenseLogic.js'

export type LicenseValidationErrorCode =
  | 'invalid_key'
  | 'subscription_inactive'
  | 'expired'
  | 'network'
  | 'timeout'
  | 'server_error'
  | 'malformed_response'

export type LicenseValidationResult =
  | {
      ok: true
      response: ServerValidationPayload
      license: LicenseState
    }
  | {
      ok: false
      errorCode: LicenseValidationErrorCode
      message: string
      response?: ServerValidationPayload
    }

function mapFailureCode(status?: string | null, expiresAt?: string | null): LicenseValidationErrorCode {
  if (status === 'expired') {
    return 'expired'
  }

  if (expiresAt) {
    const expiresMs = Date.parse(expiresAt)
    if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) {
      return 'expired'
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
    return 'subscription_inactive'
  }

  return 'invalid_key'
}

function userMessageForErrorCode(
  errorCode: LicenseValidationErrorCode,
  status?: string | null,
  expiresAt?: string | null,
): string {
  switch (errorCode) {
    case 'network':
      return 'Unable to reach the license server. Check your internet connection and try again.'
    case 'timeout':
      return 'Unable to reach the license server. Check your internet connection and try again.'
    case 'server_error':
      return 'Temporary validation error. Please try again in a few minutes.'
    case 'expired':
      return 'License expired.'
    case 'subscription_inactive':
      return 'Subscription inactive.'
    case 'malformed_response':
      return 'Temporary validation error. Please try again in a few minutes.'
    case 'invalid_key':
    default:
      return mapValidationFailureMessage(status, expiresAt)
  }
}

export async function validateLicenseWithServer(key: string): Promise<LicenseValidationResult> {
  const normalized = normalizeLicenseKey(key)
  const endpoint = getLicenseValidateUrl(app.isPackaged)

  try {
    assertLicenseEndpointSecure(endpoint, app.isPackaged)
  } catch (error) {
    console.error('[license] Invalid validation endpoint configuration', error)
    return {
      ok: false,
      errorCode: 'server_error',
      message: userMessageForErrorCode('server_error'),
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LICENSE_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ licenseKey: normalized }),
      signal: controller.signal,
    })

    const raw = await response.json().catch(() => null)
    const parsed = parseServerValidationPayload(raw)

    if (!parsed) {
      console.warn('[license] Malformed validation response for', redactLicenseKey(normalized))
      return {
        ok: false,
        errorCode: 'malformed_response',
        message: userMessageForErrorCode('malformed_response'),
      }
    }

    if (!response.ok) {
      console.warn(
        '[license] Validation HTTP error',
        response.status,
        redactLicenseKey(normalized),
      )
      return {
        ok: false,
        errorCode: 'server_error',
        message: userMessageForErrorCode('server_error'),
        response: parsed,
      }
    }

    if (parsed.valid && parsed.tier === 'pro') {
      return {
        ok: true,
        response: parsed,
        license: buildActivatedLicense(normalized, parsed.expiresAt),
      }
    }

    const errorCode = mapFailureCode(parsed.status, parsed.expiresAt)
    return {
      ok: false,
      errorCode,
      message: userMessageForErrorCode(errorCode, parsed.status, parsed.expiresAt),
      response: parsed,
    }
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError'
    const errorCode: LicenseValidationErrorCode = isAbort ? 'timeout' : 'network'
    console.warn(
      `[license] Validation request failed (${errorCode}) for`,
      redactLicenseKey(normalized),
    )
    return {
      ok: false,
      errorCode,
      message: userMessageForErrorCode(errorCode),
    }
  } finally {
    clearTimeout(timeout)
  }
}
