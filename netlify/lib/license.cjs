const crypto = require('node:crypto')

const LICENSE_PATTERN = /^SLIP-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/i
const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function normalizeLicenseKey(key) {
  return key.trim().toUpperCase()
}

function isLicenseKeyFormat(key) {
  return LICENSE_PATTERN.test(normalizeLicenseKey(key))
}

function randomSegment(length = 4) {
  const bytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i += 1) {
    result += ALPHANUM[bytes[i] % ALPHANUM.length]
  }
  return result
}

function buildLicenseKey(part1, part2, part3) {
  return `SLIP-${part1}-${part2}-${part3}`
}

/**
 * Generate a unique license key using cryptographically secure randomness.
 * Validation is server-side only (stored record + Stripe status).
 * @param {(key: string) => Promise<boolean>} isDuplicate
 */
async function generateUniqueLicenseKey(isDuplicate) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const key = buildLicenseKey(randomSegment(), randomSegment(), randomSegment())
    if (!(await isDuplicate(key))) {
      return key
    }
  }

  throw new Error('Unable to generate a unique license key')
}

module.exports = {
  normalizeLicenseKey,
  isLicenseKeyFormat,
  generateUniqueLicenseKey,
}
