const DB_NAME = 'slipupclipz-audio'
const STORE_NAME = 'clips'
const DB_VERSION = 1

type AudioRecord = {
  id: string
  blob: Blob
  mimeType: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open audio database'))
  })
}

export async function saveAudioBlob(
  id: string,
  blob: Blob,
  mimeType: string,
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save audio'))
    tx.objectStore(STORE_NAME).put({ id, blob, mimeType } satisfies AudioRecord)
  })
  db.close()
}

export async function getAudioBlob(id: string): Promise<Blob | null> {
  const db = await openDb()
  const record = await new Promise<AudioRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(id)
    request.onsuccess = () => resolve(request.result as AudioRecord | undefined)
    request.onerror = () => reject(request.error ?? new Error('Failed to load audio'))
  })
  db.close()
  return record?.blob ?? null
}

export async function deleteAudioBlob(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete audio'))
    tx.objectStore(STORE_NAME).delete(id)
  })
  db.close()
}

export function downloadAudioFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('mpeg')) return 'mp3'
  return 'audio'
}
