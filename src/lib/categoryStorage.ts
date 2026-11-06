import type { ClipCategory } from '../types/clip'

const STORAGE_KEY = 'slipupclipz-categories'
let categoriesUnreadable = false

export function categoriesLoadError(): string | null {
  return categoriesUnreadable
    ? 'Saved clip categories could not be read. They were left on this PC and were not replaced.'
    : null
}

export function loadCategories(): ClipCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      categoriesUnreadable = false
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      categoriesUnreadable = true
      return []
    }
    categoriesUnreadable = false
    return parsed
      .filter(
        (entry): entry is ClipCategory =>
          Boolean(
            entry &&
              typeof entry === 'object' &&
              typeof (entry as ClipCategory).id === 'string' &&
              typeof (entry as ClipCategory).name === 'string',
          ),
      )
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now(),
      }))
  } catch {
    categoriesUnreadable = true
    return []
  }
}

export function saveCategories(categories: ClipCategory[]): void {
  if (categoriesUnreadable) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
}
