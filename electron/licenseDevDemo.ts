import crypto from 'node:crypto'
import { LICENSE_KEY_PATTERN, normalizeLicenseKey } from './licenseLogic.js'

/**
 * Development-only checksum secret for locally generated demo keys.
 * Never used in packaged production builds.
 */
const DEV_DEMO_LICENSE_SECRET = 'slipupclipz-license-v1'

export function isDevDemoLicenseKey(key: string): boolean {
  const normalized = normalizeLicenseKey(key)
  const match = normalized.match(LICENSE_KEY_PATTERN)
  if (!match) {
    return false
  }

  const segments = [match[1], match[2]].join('')
  const checksum = crypto
    .createHash('sha256')
    .update(`${segments}:${DEV_DEMO_LICENSE_SECRET}`)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase()

  return match[3].toUpperCase() === checksum
}

/** Generates a development-only demo key. Never valid in packaged production builds. */
export function generateDevDemoLicenseKey(part1 = 'PRO1', part2 = 'FULL'): string {
  const segments = `${part1}${part2}`.slice(0, 8).padEnd(8, '0')
  const p1 = segments.slice(0, 4)
  const p2 = segments.slice(4, 8)
  const checksum = crypto
    .createHash('sha256')
    .update(`${p1}${p2}:${DEV_DEMO_LICENSE_SECRET}`)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase()

  return `SLIP-${p1}-${p2}-${checksum}`
}
