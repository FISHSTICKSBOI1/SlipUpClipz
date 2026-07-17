import { logClipPipeline, logClipPipelineError, summarizeBlob } from './clipPipelineLog'

const WEBM_EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3]
const OGG_MAGIC = [0x4f, 0x67, 0x67, 0x53]

export type ContainerInspection = {
  empty: boolean
  byteLength: number
  mimeType: string
  headerHex: string
  hasWebmEbmlHeader: boolean
  hasOggHeader: boolean
  hasMp4Ftyp: boolean
  likelyValidContainer: boolean
}

function bytesToHex(bytes: Uint8Array, max = 16): string {
  return Array.from(bytes.slice(0, max))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ')
}

function matchesMagic(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false
  return magic.every((value, index) => bytes[index] === value)
}

export async function inspectAudioContainer(blob: Blob): Promise<ContainerInspection> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const headerHex = bytesToHex(bytes)
  const hasWebmEbmlHeader = matchesMagic(bytes, WEBM_EBML_MAGIC)
  const hasOggHeader = matchesMagic(bytes, OGG_MAGIC)
  const hasMp4Ftyp =
    bytes.length >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70

  const mimeType = blob.type || '(empty type)'
  const likelyValidContainer =
    bytes.length > 0 &&
    (hasWebmEbmlHeader ||
      hasOggHeader ||
      hasMp4Ftyp ||
      mimeType.includes('webm') ||
      mimeType.includes('ogg') ||
      mimeType.includes('mp4'))

  return {
    empty: bytes.length === 0,
    byteLength: bytes.length,
    mimeType,
    headerHex,
    hasWebmEbmlHeader,
    hasOggHeader,
    hasMp4Ftyp,
    likelyValidContainer,
  }
}

export function extensionForDebugCapture(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim().toLowerCase() || 'audio/webm'
  if (base.includes('ogg')) return 'ogg'
  if (base.includes('mp4') || base.includes('mpeg')) return 'mp4'
  return 'webm'
}

export function formatDecodeException(error: unknown): {
  name: string
  message: string
  code: number | null
} {
  if (error instanceof DOMException) {
    return { name: error.name, message: error.message, code: error.code }
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message, code: null }
  }
  return { name: 'UnknownError', message: String(error), code: null }
}

export async function saveDebugCaptureBlob(blob: Blob, mimeType: string): Promise<void> {
  const inspection = await inspectAudioContainer(blob)
  const extension = extensionForDebugCapture(mimeType || blob.type)
  const filename = `debug_capture.${extension}`

  logClipPipeline('decode:debugCapture', {
    filename,
    blob: summarizeBlob(blob),
    container: inspection,
  })

  try {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)

    logClipPipeline('decode:debugCaptureSaved', {
      filename,
      method: 'browser-download',
      size: blob.size,
      note: 'Check your Downloads folder for debug_capture.*',
    })
  } catch (error) {
    logClipPipelineError('decode:debugCaptureFailed', error, {
      filename,
      blob: summarizeBlob(blob),
    })
  }
}
