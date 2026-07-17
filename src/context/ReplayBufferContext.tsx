import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { CLIP_RECORD_HOTKEY } from '@shared/appTypes'
import { useAppSettings } from './AppSettingsContext'
import { useClipLibraryContext } from './ClipLibraryContext'
import { useReplayBuffer } from '../hooks/useReplayBuffer'
import { getAudioBlob } from '../lib/audioStorage'
import { logClipPipeline, summarizeBlob } from '../lib/clipPipelineLog'
import { isElectronApp } from '../lib/electronBridge'
import { playClipSavedSound } from '../lib/uiSounds'
import type { RecordingResult } from '../types/clip'

type EditingClip = {
  id: string
  name: string
  blob: Blob
}

type ReplayBufferContextValue = ReturnType<typeof useReplayBuffer> & {
  /** Clip open in the trim editor (manual only — never set by capture). */
  editingClip: EditingClip | null
  isSaving: boolean
  lastSavedName: string | null
  clipHotkey: string
  handleClip: () => Promise<void>
  openClipEditor: (clipId: string) => Promise<boolean>
  handleSaveTrimmed: (trimmed: RecordingResult, name: string) => Promise<void>
  handleCloseEditor: () => void
}

const ReplayBufferContext = createContext<ReplayBufferContextValue | null>(null)

function notifyClipCaptured(): void {
  playClipSavedSound()
  void window.electronAPI?.captureNotification?.show()
}

export function ReplayBufferProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings()
  const { clips, addClipFromRecording, replaceClipWithTrimmed } = useClipLibraryContext()
  const replay = useReplayBuffer({
    source: settings.replayAudioSource ?? 'microphone',
    virtualAudioInputDeviceId: settings.virtualAudioInputDeviceId,
  })
  const {
    isListening,
    clipBuffer,
    resetError,
    startListening,
    stopListening,
  } = replay

  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedName, setLastSavedName] = useState<string | null>(null)
  const [editingClip, setEditingClip] = useState<EditingClip | null>(null)

  /**
   * Centralized capture success path used by the Clip button and global hotkey.
   * Never shows, focuses, restores, or navigates the main window.
   */
  const handleClip = useCallback(async () => {
    if (isSaving || !isListening) return

    resetError()
    setLastSavedName(null)
    setIsSaving(true)

    const recording = await clipBuffer()
    if (!recording) {
      setIsSaving(false)
      return
    }

    logClipPipeline('recorderPanel:captured', {
      mimeType: recording.mimeType,
      blob: summarizeBlob(recording.blob),
      durationMs: recording.durationMs,
    })

    const defaultName = `Clip ${new Date().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`

    const clip = await addClipFromRecording(recording, defaultName, {
      draft: false,
      skipDownload: true,
    })
    setIsSaving(false)

    if (clip) {
      logClipPipeline('recorderPanel:librarySaved', {
        clipId: clip.id,
        clipName: clip.name,
        blob: summarizeBlob(recording.blob),
      })
      // Sound + desktop overlay only — no editor, no navigation, no window show.
      notifyClipCaptured()
    }
  }, [addClipFromRecording, clipBuffer, isListening, isSaving, resetError])

  const openClipEditor = useCallback(
    async (clipId: string): Promise<boolean> => {
      const clip = clips.find((entry) => entry.id === clipId)
      if (!clip?.hasAudio) return false

      const blob = await getAudioBlob(clipId)
      if (!blob) return false

      setEditingClip({
        id: clip.id,
        name: clip.name,
        blob,
      })
      return true
    },
    [clips],
  )

  const handleSaveTrimmed = useCallback(
    async (trimmed: RecordingResult, name: string) => {
      if (!editingClip) return

      const trimmedName = name.trim()
      if (!trimmedName) return

      setIsSaving(true)
      const clip = await replaceClipWithTrimmed(editingClip.id, trimmed, trimmedName)
      setIsSaving(false)

      if (clip) {
        setLastSavedName(trimmedName)
        setEditingClip(null)
      }
    },
    [editingClip, replaceClipWithTrimmed],
  )

  const handleCloseEditor = useCallback(() => {
    setEditingClip(null)
  }, [])

  useEffect(() => {
    if (!isElectronApp() || !window.electronAPI?.recorder.registerClipHotkey) return
    void window.electronAPI.recorder.registerClipHotkey()
  }, [settings.clipHotkey])

  useEffect(() => {
    if (!isElectronApp() || !window.electronAPI?.onClipHotkeyTrigger) return

    return window.electronAPI.onClipHotkeyTrigger(() => {
      void handleClip()
    })
  }, [handleClip])

  useEffect(() => {
    if (!isElectronApp() || !window.electronAPI?.onTrayCommand) return

    return window.electronAPI.onTrayCommand((command) => {
      if (command !== 'toggle-replay-buffer') return
      if (isListening) {
        stopListening()
      } else {
        void startListening()
      }
    })
  }, [isListening, startListening, stopListening])

  const value: ReplayBufferContextValue = {
    ...replay,
    editingClip,
    isSaving,
    lastSavedName,
    clipHotkey: settings.clipHotkey || CLIP_RECORD_HOTKEY,
    handleClip,
    openClipEditor,
    handleSaveTrimmed,
    handleCloseEditor,
  }

  return (
    <ReplayBufferContext.Provider value={value}>{children}</ReplayBufferContext.Provider>
  )
}

export function useReplayBufferContext(): ReplayBufferContextValue {
  const context = useContext(ReplayBufferContext)
  if (!context) {
    throw new Error('useReplayBufferContext must be used within ReplayBufferProvider')
  }
  return context
}
