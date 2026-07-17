import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playClipAudio, stopPlayback } from '../lib/audioPlayback'
import {
  decodeAudioDurationMs,
  displayNameFromFileName,
  findDuplicateImport,
  fingerprintAudioFile,
  isSupportedAudioFile,
  mimeTypeForImport,
} from '../lib/audioImport'
import {
  deleteAudioBlob,
  downloadAudioFile,
  extensionForMimeType,
  getAudioBlob,
  saveAudioBlob,
} from '../lib/audioStorage'
import { loadCategories, saveCategories } from '../lib/categoryStorage'
import { loadClips, saveClips } from '../lib/clipStorage'
import { loadSoundboardState } from '../lib/soundboardStorage'
import {
  invalidateClipAudio,
  playClipInstant,
  preloadClipAudioMany,
  stopAllInstantPlayback,
  stopClipInstant,
} from '../lib/soundboardAudio'
import type {
  AddClipOptions,
  Clip,
  ClipCategory,
  ImportAudioResult,
  RecordingResult,
} from '../types/clip'

export function useClipLibrary() {
  const [clips, setClips] = useState<Clip[]>(() => loadClips())
  const [categories, setCategories] = useState<ClipCategory[]>(() => loadCategories())
  const [search, setSearch] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const playingIdRef = useRef<string | null>(null)

  useEffect(() => {
    saveClips(clips)
  }, [clips])

  useEffect(() => {
    saveCategories(categories)
  }, [categories])

  useEffect(() => {
    return () => stopPlayback()
  }, [])

  useEffect(() => {
    const clipIds = clips
      .filter((clip) => clip.hasAudio && !clip.isDraft)
      .map((clip) => clip.id)

    void preloadClipAudioMany(clipIds)
  }, [clips])

  const playClipSoundboard = useCallback(
    async (id: string, volume?: number) => {
      const clip = clips.find((entry) => entry.id === id)
      if (!clip?.hasAudio || clip.isDraft) return false

      const resolvedVolume =
        volume ??
        loadSoundboardState().pads.find((pad) => pad.clipId === id)?.volume ??
        100

      const started = await playClipInstant(id, { volume: resolvedVolume })
      if (started) {
        setClips((prev) =>
          prev.map((entry) =>
            entry.id === id ? { ...entry, lastPlayedAt: Date.now() } : entry,
          ),
        )
      }
      return started
    },
    [clips],
  )

  const stopClipSoundboard = useCallback((id: string) => {
    stopClipInstant(id)
  }, [])

  const stopAllSoundboard = useCallback(() => {
    stopAllInstantPlayback()
  }, [])

  const filteredClips = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = query
      ? clips.filter((clip) => {
          const categoryName =
            categories.find((category) => category.id === clip.categoryId)?.name ?? ''
          return (
            clip.name.toLowerCase().includes(query) ||
            clip.hotkey?.toLowerCase().includes(query) ||
            clip.originalFileName?.toLowerCase().includes(query) ||
            categoryName.toLowerCase().includes(query)
          )
        })
      : clips

    return [...filtered].sort((a, b) => b.createdAt - a.createdAt)
  }, [categories, clips, search])

  const playClip = useCallback(async (id: string) => {
    const clip = clips.find((entry) => entry.id === id)
    if (!clip?.hasAudio) return

    if (playingIdRef.current === id) {
      stopPlayback()
      playingIdRef.current = null
      setPlayingId(null)
      return
    }

    stopPlayback()
    playingIdRef.current = id
    setPlayingId(id)

    const started = await playClipAudio(id, () => {
      playingIdRef.current = null
      setPlayingId(null)
    })

    if (!started) {
      playingIdRef.current = null
      setPlayingId(null)
    }
  }, [clips])

  const renameClip = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setClips((prev) =>
      prev.map((clip) => (clip.id === id ? { ...clip, name: trimmed } : clip)),
    )
  }, [])

  const deleteClip = useCallback((id: string) => {
    void deleteAudioBlob(id)
    invalidateClipAudio(id)
    stopClipInstant(id)
    if (playingIdRef.current === id) {
      stopPlayback()
      playingIdRef.current = null
      setPlayingId(null)
    }
    setClips((prev) => prev.filter((clip) => clip.id !== id))
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setClips((prev) =>
      prev.map((clip) =>
        clip.id === id ? { ...clip, favorite: !clip.favorite } : clip,
      ),
    )
  }, [])

  const setClipCategory = useCallback((id: string, categoryId: string | null) => {
    setClips((prev) =>
      prev.map((clip) => (clip.id === id ? { ...clip, categoryId } : clip)),
    )
  }, [])

  const assignHotkey = useCallback((id: string, hotkey: string | undefined) => {
    setClips((prev) =>
      prev.map((clip) => {
        if (clip.id === id) {
          return { ...clip, hotkey: hotkey || undefined }
        }
        if (hotkey && clip.hotkey === hotkey) {
          return { ...clip, hotkey: undefined }
        }
        return clip
      }),
    )
  }, [])

  const addClip = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return

    const clip: Clip = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: Date.now(),
      durationMs: 2000,
      source: 'recorded',
    }
    setClips((prev) => [clip, ...prev])
  }, [])

  const addClipFromRecording = useCallback(
    async (
      recording: RecordingResult,
      name: string,
      options: AddClipOptions = {},
    ) => {
      const trimmed = name.trim()
      if (!trimmed) return null

      const id = crypto.randomUUID()
      await saveAudioBlob(id, recording.blob, recording.mimeType)

      const clip: Clip = {
        id,
        name: trimmed,
        createdAt: Date.now(),
        durationMs: recording.durationMs,
        hasAudio: true,
        mimeType: recording.mimeType,
        isDraft: options.draft ?? false,
        source: 'recorded',
      }

      setClips((prev) => [clip, ...prev])
      return clip
    },
    [],
  )

  const importAudioFile = useCallback(
    async (file: File, options: { allowDuplicate?: boolean } = {}): Promise<ImportAudioResult> => {
      if (!isSupportedAudioFile(file)) {
        return {
          ok: false,
          error: 'Unsupported file type. Please choose an MP3 or WAV file.',
        }
      }

      try {
        const fingerprint = await fingerprintAudioFile(file)
        const duplicate = findDuplicateImport(clips, fingerprint)
        if (duplicate && !options.allowDuplicate) {
          return {
            ok: true,
            clip: duplicate,
            duplicateOf: duplicate,
          }
        }

        const mimeType = mimeTypeForImport(file)
        const blob = file.slice(0, file.size, mimeType)
        const durationMs = await decodeAudioDurationMs(blob)
        const id = crypto.randomUUID()
        await saveAudioBlob(id, blob, mimeType)

        const clip: Clip = {
          id,
          name: displayNameFromFileName(file.name),
          createdAt: Date.now(),
          durationMs,
          hasAudio: true,
          mimeType,
          source: 'imported',
          originalFileName: file.name,
          importFingerprint: fingerprint,
        }

        setClips((prev) => [clip, ...prev])
        return { ok: true, clip }
      } catch {
        return {
          ok: false,
          error: 'Could not read that audio file. It may be damaged or unsupported.',
        }
      }
    },
    [clips],
  )

  const replaceClipAudio = useCallback(
    async (id: string, file: File): Promise<ImportAudioResult> => {
      if (!isSupportedAudioFile(file)) {
        return {
          ok: false,
          error: 'Unsupported file type. Please choose an MP3 or WAV file.',
        }
      }

      const existing = clips.find((clip) => clip.id === id)
      if (!existing) {
        return { ok: false, error: 'Clip not found.' }
      }

      try {
        const mimeType = mimeTypeForImport(file)
        const blob = file.slice(0, file.size, mimeType)
        const durationMs = await decodeAudioDurationMs(blob)
        const fingerprint = await fingerprintAudioFile(file)
        await saveAudioBlob(id, blob, mimeType)
        invalidateClipAudio(id)

        const updated: Clip = {
          ...existing,
          durationMs,
          mimeType,
          hasAudio: true,
          isDraft: false,
          source: 'imported',
          originalFileName: file.name,
          importFingerprint: fingerprint,
          name: existing.name || displayNameFromFileName(file.name),
        }

        setClips((prev) => prev.map((clip) => (clip.id === id ? updated : clip)))
        return { ok: true, clip: updated }
      } catch {
        return {
          ok: false,
          error: 'Could not replace the sound with that file.',
        }
      }
    },
    [clips],
  )

  const replaceClipWithTrimmed = useCallback(
    async (id: string, recording: RecordingResult, name?: string) => {
      const clip = clips.find((entry) => entry.id === id)
      if (!clip) return null

      const finalName = name?.trim() || clip.name

      await saveAudioBlob(id, recording.blob, recording.mimeType)
      invalidateClipAudio(id)

      const updated: Clip = {
        ...clip,
        name: finalName,
        durationMs: recording.durationMs,
        mimeType: recording.mimeType,
        isDraft: false,
        source: clip.source ?? 'recorded',
      }

      setClips((prev) => prev.map((entry) => (entry.id === id ? updated : entry)))
      return updated
    },
    [clips],
  )

  const cancelDraftClip = useCallback((id: string) => {
    void deleteAudioBlob(id)
    invalidateClipAudio(id)
    if (playingIdRef.current === id) {
      stopPlayback()
      playingIdRef.current = null
      setPlayingId(null)
    }
    setClips((prev) => prev.filter((clip) => clip.id !== id))
  }, [])

  const exportClip = useCallback(async (id: string) => {
    const clip = clips.find((entry) => entry.id === id)
    if (!clip?.hasAudio || clip.isDraft) return false

    const blob = await getAudioBlob(id)
    if (!blob) return false

    const ext = extensionForMimeType(clip.mimeType ?? blob.type)
    downloadAudioFile(blob, `${clip.name}.${ext}`)
    return true
  }, [clips])

  const createCategory = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const category: ClipCategory = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: Date.now(),
    }
    setCategories((prev) => [...prev, category])
    return category
  }, [])

  const renameCategory = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setCategories((prev) =>
      prev.map((category) =>
        category.id === id ? { ...category, name: trimmed } : category,
      ),
    )
  }, [])

  const deleteCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((category) => category.id !== id))
    setClips((prev) =>
      prev.map((clip) =>
        clip.categoryId === id ? { ...clip, categoryId: null } : clip,
      ),
    )
  }, [])

  return {
    clips,
    categories,
    filteredClips,
    search,
    setSearch,
    playingId,
    playClip,
    playClipSoundboard,
    stopClipSoundboard,
    stopAllSoundboard,
    renameClip,
    deleteClip,
    toggleFavorite,
    setClipCategory,
    assignHotkey,
    addClip,
    addClipFromRecording,
    importAudioFile,
    replaceClipAudio,
    replaceClipWithTrimmed,
    cancelDraftClip,
    exportClip,
    createCategory,
    renameCategory,
    deleteCategory,
  }
}

export type ClipLibrary = ReturnType<typeof useClipLibrary>
