/** Production license validation endpoint (HTTPS only in packaged builds). */
export const LICENSE_VALIDATE_URL_PRODUCTION =
  'https://slipupclipz.com/.netlify/functions/validate-license'

/** Default local Netlify dev endpoint for unpackaged development. */
export const LICENSE_VALIDATE_URL_DEVELOPMENT =
  'http://localhost:8888/.netlify/functions/validate-license'

/** Allow Pro offline for up to 7 days after the last successful online validation. */
export const LICENSE_OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000

/** Revalidate at most once every 12 hours during normal operation. */
export const LICENSE_REVALIDATION_INTERVAL_MS = 12 * 60 * 60 * 1000

/** Network timeout for license validation requests. */
export const LICENSE_REQUEST_TIMEOUT_MS = 15_000

/**
 * Packaged production builds always use the production HTTPS endpoint.
 * Localhost / env overrides are only allowed when the app is unpackaged (dev).
 */
export function getLicenseValidateUrl(isPackaged: boolean): string {
  if (isPackaged) {
    return LICENSE_VALIDATE_URL_PRODUCTION
  }

  const override =
    process.env.SLIPUPCLIP_VALIDATE_URL?.trim() ||
    process.env.SLIPUPCLIP_DEV_VALIDATE_URL?.trim()
  if (override) {
    return override
  }

  return LICENSE_VALIDATE_URL_DEVELOPMENT
}

export function assertLicenseEndpointSecure(url: string, isPackaged: boolean): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid license validation URL')
  }

  if (isPackaged && parsed.protocol !== 'https:') {
    throw new Error('License validation requires HTTPS in production builds')
  }

  if (isPackaged && parsed.hostname !== 'slipupclipz.com') {
    throw new Error('License validation must use slipupclipz.com in production builds')
  }
}
