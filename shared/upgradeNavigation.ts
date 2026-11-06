export type UpgradeNavigationState = {
  upgradeFocus: number
}

let focusSequence = 0

/** A new token on every call so repeat clicks scroll and highlight again. */
export function upgradeNavigationState(): UpgradeNavigationState {
  focusSequence += 1
  return { upgradeFocus: focusSequence }
}

export function readUpgradeFocus(state: unknown): number | null {
  if (!state || typeof state !== 'object') return null
  const value = (state as { upgradeFocus?: unknown }).upgradeFocus
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
