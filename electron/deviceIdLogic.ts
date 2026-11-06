import { createHash } from 'node:crypto'

const HASH_PURPOSE = 'slipupclipz-device-v1'

/** Hash a stable install secret. The raw value is not stored or sent. */
export function hashDeviceSource(source: string): string {
  return createHash('sha256').update(`${HASH_PURPOSE}\n${source}`).digest('hex')
}
