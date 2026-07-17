import type { Clip, ImportAudioResult } from '../types/clip'

const SUPPORTED_EXTENSIONS = new Set(['mp3', 'wav'])
const SUPPORTED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/vnd.wave',
])

export function isSupportedAudioFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (SUPPORTED_EXTENSIONS.has(extension)) return true
  if (file.type && SUPPORTED_MIME_TYPES.has(file.type.toLowerCase())) return true
  return false
}

export function mimeTypeForImport(file: File): string {
  if (file.type && SUPPORTED_MIME_TYPES.has(file.type.toLowerCase())) {
    return file.type
  }
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'wav') return 'audio/wav'
  return 'audio/mpeg'
}

export function displayNameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim()
  return base || fileName
}

export async function fingerprintAudioFile(file: File): Promise<string> {
  const slice = file.slice(0, Math.min(file.size, 256 * 1024))
  const buffer = await slice.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let hash = file.size >>> 0
  for (let i = 0; i < bytes.length; i += 17) {
    hash = (hash * 31 + bytes[i]) >>> 0
  }
  return `${file.name.toLowerCase()}|${file.size}|${hash.toString(16)}`
}

export async function decodeAudioDurationMs(blob: Blob): Promise<number> {
  const context = new AudioContext()
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0))
    return Math.max(1, Math.round(audioBuffer.duration * 1000))
  } finally {
    await context.close()
  }
}

export function findDuplicateImport(
  clips: Clip[],
  fingerprint: string,
): Clip | undefined {
  return clips.find(
    (clip) => clip.importFingerprint === fingerprint && clip.hasAudio && !clip.isDraft,
  )
}

export type { ImportAudioResult }
