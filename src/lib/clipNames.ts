/** Pick a library name that does not collide with names already in use. */
export function uniqueClipName(base: string, taken: Set<string>): string {
  const trimmed = base.trim() || 'AI clip'
  if (!taken.has(trimmed.toLowerCase())) return trimmed
  let suffix = 2
  while (taken.has(`${trimmed} (${suffix})`.toLowerCase())) suffix += 1
  return `${trimmed} (${suffix})`
}
