export function normalizeCreatorCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}
