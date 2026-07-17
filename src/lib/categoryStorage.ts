import type { ClipCategory } from '../types/clip'

const STORAGE_KEY = 'slipupclipz-categories'

export function loadCategories(): ClipCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
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
    return []
  }
}

export function saveCategories(categories: ClipCategory[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
}
