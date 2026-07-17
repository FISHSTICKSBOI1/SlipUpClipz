#!/usr/bin/env node
/**
 * Development-only demo key generator.
 * Keys work only in unpackaged Electron builds via licenseDevDemo.ts.
 * Paid production licenses require server validation.
 */
import crypto from 'node:crypto'

const LICENSE_SECRET = 'slipupclipz-license-v1'

function generateLicenseKey(prefix = 'PRO1', middle = 'FULL') {
  const segments = `${prefix}${middle}`.slice(0, 8).padEnd(8, '0')
  const part1 = segments.slice(0, 4)
  const part2 = segments.slice(4, 8)
  const checksum = crypto
    .createHash('sha256')
    .update(`${part1}${part2}:${LICENSE_SECRET}`)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase()

  return `SLIP-${part1}-${part2}-${checksum}`
}

console.log('Demo Pro license keys:')
console.log(generateLicenseKey('PRO1', 'FULL'))
console.log(generateLicenseKey('DEMO', 'TEST'))
