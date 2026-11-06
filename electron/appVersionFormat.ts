/** Shown version. Unpackaged builds are marked so they are not mistaken for a release. */
export function formatDisplayedVersion(version: string, packaged: boolean): string {
  const base = version.trim() || '0.0.0'
  if (packaged) return base
  return base.endsWith('-dev') ? base : `${base}-dev`
}
