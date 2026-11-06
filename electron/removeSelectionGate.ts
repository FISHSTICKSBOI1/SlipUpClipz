import { requiresProLicense } from '../shared/appTypes.js'

/** Main-process decision for the Pro-only cut. Ordinary trimming does not call this. */
export function authorizeRemoveSelection(
  isPro: boolean,
): { ok: true } | { ok: false; error: string } {
  if (requiresProLicense('removeSelection') && !isPro) {
    return { ok: false, error: 'Remove Selection is a Pro feature.' }
  }
  return { ok: true }
}
