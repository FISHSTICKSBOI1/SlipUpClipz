import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { hashDeviceSource } from './deviceIdLogic.js'
import { settingsStore } from './store.js'

const DEVICE_ID_PATTERN = /^[a-f0-9]{64}$/

export function readWindowsMachineGuid(): string | null {
  if (process.platform !== 'win32') return null
  try {
    const output = execFileSync(
      'reg',
      ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
      { encoding: 'utf8', windowsHide: true, timeout: 3000 },
    )
    const match = output.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{8,})/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * One privacy-conscious id for this Windows install.
 * Uses the Windows machine GUID when it is available, so reinstalling the
 * app does not look like a new computer. Nothing else about the hardware is read.
 */
export function getInstalledDeviceId(): string {
  const guid = readWindowsMachineGuid()
  if (guid) return hashDeviceSource(guid)

  const existing = settingsStore.get('deviceId')
  if (typeof existing === 'string' && DEVICE_ID_PATTERN.test(existing)) return existing

  const created = hashDeviceSource(randomBytes(32).toString('hex'))
  settingsStore.set('deviceId', created)
  return created
}
