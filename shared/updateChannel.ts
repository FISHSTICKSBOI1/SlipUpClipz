export const MICROSOFT_STORE_PRODUCT_ID = '9N89SSLR9769'

/** Opens the installed Store listing. This is not an installer download. */
export const MICROSOFT_STORE_LISTING_URL = `ms-windows-store://pdp/?ProductId=${MICROSOFT_STORE_PRODUCT_ID}`

export function isMicrosoftStorePackage(
  windowsStore: boolean | undefined,
  execPath = '',
): boolean {
  if (windowsStore === true) return true
  // GetCurrentPackageFullName can fail for some full-trust MSIX hosts.
  // Installed Store/MSIX binaries live under WindowsApps.
  return /(?:^|[/\\])windowsapps[/\\]/i.test(execPath)
}

export type UpdateDistribution = 'github' | 'microsoft-store' | 'unpackaged'

/** Store MSIX, website NSIS, or an unpackaged development build. */
export function updateDistribution(input: {
  packaged: boolean
  windowsStore?: boolean
  execPath?: string
}): UpdateDistribution {
  if (isMicrosoftStorePackage(input.windowsStore, input.execPath)) return 'microsoft-store'
  if (!input.packaged) return 'unpackaged'
  return 'github'
}

export function githubNsisUpdatesAllowed(distribution: UpdateDistribution): boolean {
  return distribution === 'github'
}

/** True only when every numeric part shows a strictly newer release. */
export function isNewerRelease(current: string, available: string): boolean {
  const parts = (value: string) =>
    value.split(/[^0-9]+/).filter(Boolean).map((part) => Number.parseInt(part, 10))
  const left = parts(current)
  const right = parts(available)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0)
    if (difference > 0) return true
    if (difference < 0) return false
  }
  return false
}
