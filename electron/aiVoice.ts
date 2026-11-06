import { ipcMain, type BrowserWindow } from 'electron'
import { MAX_REFERENCE_TEXT_CHARS, MAX_WAV_BYTES } from '../shared/aiReference.js'
import { requiresProLicense } from '../shared/appTypes.js'
import { type AiWorkerController, type WorkerSession } from './aiWorkerControl.js'
import { getAiWorker } from './aiWorker.js'
import { isProLicense } from './license.js'
import { getLicense } from './store.js'

const MAX_RETURN_BYTES = 12 * 1024 * 1024

type GenerateInput = {
  audioWav: Uint8Array
  refText: string
  text: string
  temporary?: boolean
  sessionId?: string
  consent?: boolean
  requestId?: string
}

type TranscribeInput = {
  audioWav: Uint8Array
  consent?: boolean
}

export type TranscribeResult = {
  text: string
  noSpeech: boolean
  unclear: boolean
  truncated: boolean
}

function assertWavPayload(audioWav: unknown): Uint8Array {
  if (!(audioWav instanceof Uint8Array) || audioWav.length > MAX_WAV_BYTES || audioWav.length < 500) {
    throw new Error('Invalid reference audio.')
  }
  return audioWav
}

function wavFormData(audioWav: Uint8Array): FormData {
  const form = new FormData()
  const referenceBytes = new Uint8Array(audioWav.length)
  referenceBytes.set(audioWav)
  form.append('reference_audio', new Blob([referenceBytes.buffer as ArrayBuffer], { type: 'audio/wav' }), 'reference.wav')
  return form
}

async function readAiError(response: Response, fallback: string): Promise<string> {
  try {
    const error = await response.json() as { detail?: unknown }
    if (typeof error.detail === 'string') return error.detail
  } catch { /* keep fallback */ }
  return fallback
}

function generationRequestId(value: unknown): string {
  return typeof value === 'string' && /^gen-[\w.-]{1,80}$/.test(value) ? value : ''
}

function generationSessionId(value: unknown): string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : ''
}

function publishGenerationStage(
  getMainWindow: () => BrowserWindow | null,
  requestId: string,
  stage: 'loading' | 'generating' | 'finishing',
): void {
  if (!requestId) return
  const window = getMainWindow()
  if (!window || window.isDestroyed()) return
  window.webContents.send('ai:generate-progress', { requestId, stage })
}

function worker(): AiWorkerController {
  return getAiWorker()
}

async function postAi(session: WorkerSession, pathname: string, form: FormData, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(`${session.url}${pathname}`, {
      method: 'POST',
      headers: {
        'X-SlipUpClipz-Client': 'electron',
        'X-SlipUpClipz-Worker': session.token,
      },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    const timedOut = name === 'TimeoutError' || name === 'AbortError'
    console.error(timedOut ? '[ai] connection failure: timed out' : '[ai] connection failure', error)
    if (timedOut) {
      throw new Error('AI Clone took too long to finish. Try again.')
    }
    throw new Error('The AI engine stopped before it finished. Try again.')
  }
}

function ensureSource(event: Electron.IpcMainInvokeEvent, getMainWindow: () => BrowserWindow | null) {
  if (event.sender.id !== getMainWindow()?.webContents.id) {
    throw new Error('Unexpected AI request source.')
  }
}

function ensureAiEntitlement(): void {
  if (requiresProLicense('aiVoice') && !isProLicense(getLicense())) {
    throw new Error('AI Voice Cloning is a Pro feature.')
  }
}

export function registerAiVoiceIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('ai:health', async (event) => {
    ensureSource(event, getMainWindow)
    return worker().health()
  })

  ipcMain.handle('ai:transcribe', async (event, input: TranscribeInput): Promise<TranscribeResult> => {
    ensureSource(event, getMainWindow)
    ensureAiEntitlement()
    const audioWav = assertWavPayload(input?.audioWav)
    const form = wavFormData(audioWav)

    const response = await worker().run(input?.consent === true, (session) => postAi(session, '/transcribe-from-clip', form, 60000))

    if (!response.ok) {
      throw new Error(await readAiError(response, `AI server returned HTTP ${response.status}.`))
    }

    const payload = await response.json().catch(() => null) as Partial<TranscribeResult> | null
    if (!payload || typeof payload.text !== 'string' || typeof payload.noSpeech !== 'boolean' || typeof payload.unclear !== 'boolean') {
      throw new Error('Transcription failed. Enter the words manually.')
    }
    return {
      text: payload.text,
      noSpeech: payload.noSpeech,
      unclear: payload.unclear,
      truncated: payload.truncated === true,
    }
  })

  ipcMain.handle('ai:generate', async (event, input: GenerateInput): Promise<Uint8Array> => {
    ensureSource(event, getMainWindow)
    ensureAiEntitlement()
    const audioWav = assertWavPayload(input?.audioWav)
    const text = input.text?.trim()
    const refText = input.refText?.trim()
    if (!text || text.length > 500 || !refText || refText.length > MAX_REFERENCE_TEXT_CHARS) {
      throw new Error('Please enter the reference transcript and up to 500 characters of speech.')
    }

    const form = wavFormData(audioWav)
    form.append('text', text)
    form.append('ref_text', refText)
    const sessionId = generationSessionId(input.sessionId)
    if (sessionId) form.append('session_id', sessionId)
    if (input.temporary !== false) form.append('temporary', '1')

    const requestId = generationRequestId(input?.requestId)
    const response = await worker().run(
      input?.consent === true,
      (session) => {
        publishGenerationStage(getMainWindow, requestId, 'generating')
        return postAi(session, '/generate-from-clip', form, 180000)
      },
      {
        onLoading: () => publishGenerationStage(getMainWindow, requestId, 'loading'),
      },
    )

    if (!response.ok) {
      throw new Error(await readAiError(response, `AI server returned HTTP ${response.status}.`))
    }

    publishGenerationStage(getMainWindow, requestId, 'finishing')

    if (Number(response.headers.get('content-length') ?? 0) > MAX_RETURN_BYTES) {
      throw new Error('Generated audio exceeds the size limit.')
    }
    const data = await response.arrayBuffer()
    if (!data.byteLength || data.byteLength > MAX_RETURN_BYTES) {
      throw new Error('Generated audio was empty or too large.')
    }
    return new Uint8Array(data)
  })
}
