import { useEffect, useMemo, useRef, useState } from 'react'
import { SoundboardGrid, type SoundboardFilter } from '../components/soundboard/SoundboardGrid'
import { SoundboardMixerControls } from '../components/soundboard/SoundboardMixerControls'
import { VoiceEffectsControls } from '../components/soundboard/VoiceEffectsControls'
import { VirtualAudioSetupPanel } from '../components/settings/VirtualAudioSetupPanel'
import { useAppSettings } from '../context/AppSettingsContext'
import { useClipLibraryContext } from '../context/ClipLibraryContext'
import { useLicense } from '../context/LicenseContext'
import { useActiveOutputDeviceLabel, useAudioOutputDevices } from '../hooks/useAudioOutputDevices'
import { shouldIgnoreGlobalHotkey } from '../lib/hotkey'
import { TOUR_TARGET } from '../lib/onboardingTour'
import { preloadClipAudioMany, warmUpAudioEngine } from '../lib/soundboardAudio'
import { playToggleSound } from '../lib/uiSounds'
import {
  ArrowUpTrayIcon,
  FolderIcon,
  SearchIcon,
  StopIcon,
} from '../components/icons'

const FILTERS: Array<{ id: SoundboardFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'recent', label: 'Recently used' },
  { id: 'recorded', label: 'Recorded' },
  { id: 'imported', label: 'Imported' },
]

export function SoundboardPage() {
  const {
    clips,
    categories,
    importAudioFile,
    createCategory,
    renameCategory,
    deleteCategory,
    stopAllSoundboard,
  } = useClipLibraryContext()
  const { isPro } = useLicense()
  const { settings, updateSettings } = useAppSettings()
  const { devices, hasVirtualOutput, isLoading: devicesLoading } = useAudioOutputDevices()
  const activeOutputLabel = useActiveOutputDeviceLabel(devices, settings)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<SoundboardFilter>('all')
  const [importError, setImportError] = useState<string | null>(null)
  const [importNotice, setImportNotice] = useState<string | null>(null)
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)

  const hotkeyCount = clips.filter((clip) => clip.hotkey && clip.hasAudio).length

  useEffect(() => {
    warmUpAudioEngine()

    const clipIds = clips
      .filter((clip) => clip.hasAudio && !clip.isDraft)
      .map((clip) => clip.id)

    void preloadClipAudioMany(clipIds)
  }, [clips])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreGlobalHotkey(event)) return
      const parts: string[] = []
      if (event.ctrlKey) parts.push('Ctrl')
      if (event.altKey) parts.push('Alt')
      if (event.shiftKey) parts.push('Shift')
      if (event.metaKey) parts.push('Meta')
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
        parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key)
      }
      const pressed = parts.join('+')
      if (settings.stopAllHotkey && pressed === settings.stopAllHotkey) {
        event.preventDefault()
        stopAllSoundboard()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settings.stopAllHotkey, stopAllSoundboard])

  async function handleImportFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (files.length === 0) return

    setImportError(null)
    setImportNotice(null)

    for (const file of files) {
      const result = await importAudioFile(file)
      if (!result.ok) {
        setImportError(result.error)
        continue
      }

      if (result.duplicateOf) {
        const confirmed = window.confirm(
          `"${file.name}" looks like it was already imported as "${result.duplicateOf.name}". Import another copy anyway?`,
        )
        if (confirmed) {
          const forced = await importAudioFile(file, { allowDuplicate: true })
          if (!forced.ok) {
            setImportError(forced.error)
          } else {
            setImportNotice(`Imported another copy of ${file.name}.`)
          }
        } else {
          setImportNotice(`Skipped duplicate: ${file.name}`)
        }
      } else {
        setImportNotice(`Imported ${result.clip.name}.`)
      }
    }
  }

  const categorySummary = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        count: clips.filter((clip) => clip.categoryId === category.id).length,
      })),
    [categories, clips],
  )

  return (
    <div
      className="mx-auto max-w-5xl space-y-6"
      onDragEnter={(event) => {
        event.preventDefault()
        if (event.dataTransfer.types.includes('Files')) {
          setDraggingFiles(true)
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          setDraggingFiles(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDraggingFiles(false)
        if (event.dataTransfer.files?.length) {
          void handleImportFiles(event.dataTransfer.files)
        }
      }}
    >
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Soundboard</h1>
          <p className="page-desc">
            Route mic + pads like a gaming voice utility. Import audio, assign hotkeys, and play
            instantly.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => stopAllSoundboard()}
            className="btn-secondary !py-2 !text-xs"
            title={settings.stopAllHotkey ? `Hotkey: ${settings.stopAllHotkey}` : 'Stop all sounds'}
          >
            <StopIcon className="h-3.5 w-3.5" />
            Stop All
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="btn-primary !py-2 !text-xs"
          >
            <ArrowUpTrayIcon className="h-3.5 w-3.5" />
            Import Audio
          </button>
        </div>
      </section>

      {draggingFiles && (
        <div className="rounded-2xl border border-dashed border-accent bg-accent/10 px-4 py-8 text-center text-sm font-medium text-accent-hover">
          Drop MP3 or WAV files to import them into SlipUpClipz
        </div>
      )}

      {(importError || importNotice) && (
        <p
          className={`rounded-xl border px-3 py-2 text-xs ${
            importError
              ? 'border-red-500/20 bg-red-500/10 text-red-300'
              : 'border-clip/25 bg-clip/10 text-clip-hover'
          }`}
        >
          {importError ?? importNotice}
        </p>
      )}

      <section className="space-y-4" data-tour={TOUR_TARGET.audioSetup}>
        {!devicesLoading && !hasVirtualOutput && (
          <div className="panel p-4">
            <VirtualAudioSetupPanel compact />
          </div>
        )}

        <div className="control-strip">
          <div className="stat-chip sm:col-span-2 xl:col-span-1">
            <p className="control-label">Output</p>
            <p className="mt-1 truncate text-sm font-medium text-white">
              {isPro ? activeOutputLabel : 'Default device (Free)'}
            </p>
          </div>
          <div className="stat-chip flex items-center justify-between gap-3 sm:col-span-2 xl:col-span-3">
            <div>
              <p className="control-label">Hear myself</p>
              <p className="helper-text mt-1">Monitor processed mic + pads locally</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.hearMyself}
              onClick={() => {
                const nextValue = !settings.hearMyself
                playToggleSound(nextValue)
                void updateSettings({ hearMyself: nextValue })
              }}
              className={`toggle-track ${settings.hearMyself ? 'bg-accent' : 'bg-surface-border'}`}
            >
              <span
                className={`toggle-thumb ${settings.hearMyself ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </div>

        <SoundboardMixerControls />
      </section>

      <div data-tour={TOUR_TARGET.voiceEffects}>
        <VoiceEffectsControls />
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-white/5 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <FolderIcon className="h-4 w-4 text-accent-hover" />
            <h2 className="section-title">Categories</h2>
          </div>
        </div>
        <div className="space-y-3 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <span className="badge-idle">
              Uncategorized · {clips.filter((clip) => !clip.categoryId).length}
            </span>
            {categorySummary.map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1"
              >
                {editingCategoryId === category.id ? (
                  <input
                    autoFocus
                    value={editingCategoryName}
                    onChange={(event) => setEditingCategoryName(event.target.value)}
                    onBlur={() => {
                      renameCategory(category.id, editingCategoryName)
                      setEditingCategoryId(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        renameCategory(category.id, editingCategoryName)
                        setEditingCategoryId(null)
                      }
                    }}
                    className="w-28 rounded bg-surface px-1 text-[11px] text-white outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    className="text-[11px] text-ink-soft"
                    onClick={() => {
                      setEditingCategoryId(category.id)
                      setEditingCategoryName(category.name)
                    }}
                    title="Rename category"
                  >
                    {category.name} · {category.count}
                  </button>
                )}
                <button
                  type="button"
                  className="text-[10px] text-ink-faint hover:text-red-300"
                  title="Delete category (keeps sounds)"
                  onClick={() => deleteCategory(category.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={categoryDraft}
              onChange={(event) => setCategoryDraft(event.target.value)}
              placeholder="New category name"
              className="field-input min-w-[180px] flex-1 !py-2 !text-xs"
            />
            <button
              type="button"
              onClick={() => {
                createCategory(categoryDraft)
                setCategoryDraft('')
              }}
              className="btn-secondary !py-2 !text-xs"
            >
              Create category
            </button>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4 sm:px-6">
          <div>
            <h2 className="section-title">Pad grid</h2>
            <p className="helper-text mt-1">
              Drag pads to reorder. Scroll for up to 50 Pro pads.
            </p>
          </div>
          <span className="badge-accent">
            {hotkeyCount} hotkey{hotkeyCount === 1 ? '' : 's'}{' '}
            {isPro && settings.globalHotkeysEnabled ? '· global' : '· in-app'}
          </span>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, file, hotkey, or category"
              className="field-input pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setFilter(entry.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === entry.id
                    ? 'border-accent bg-accent/25 text-white'
                    : 'border-white/10 text-ink-muted hover:border-accent/40 hover:text-white'
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {!settings.hearMyself && settings.routeToVBCable && (
            <p className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 helper-text">
              Clips play to your configured output only. Enable Hear myself to monitor on speakers.
            </p>
          )}

          <div data-tour={TOUR_TARGET.soundboardPads}>
            <SoundboardGrid
              filter={filter}
              search={search}
              onRequestImport={() => importInputRef.current?.click()}
            />
          </div>
        </div>
      </section>

      <input
        ref={importInputRef}
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav,audio/wave,audio/x-wav"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) {
            void handleImportFiles(event.target.files)
          }
          event.target.value = ''
        }}
      />
    </div>
  )
}
