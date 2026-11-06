import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { upgradeNavigationState } from '@shared/upgradeNavigation'
import { useClipLibraryContext } from '../../context/ClipLibraryContext'
import { useLicense } from '../../context/LicenseContext'
import { useReplayBufferContext } from '../../context/ReplayBufferContext'
import { FilmIcon, PlusIcon, SearchIcon } from '../icons'
import { clipLibraryLoadError } from '../../lib/clipStorage'
import { importAudioBatch } from '../../lib/importAudioBatch'
import { ClipCard } from './ClipCard'
import { AIVoiceDialog } from './AIVoiceDialog'
import { DeleteClipDialog } from './DeleteClipDialog'
import { HotkeyDialog } from './HotkeyDialog'
import { RecorderPanel } from './RecorderPanel'
import { TOUR_TARGET } from '../../lib/onboardingTour'

export function ClipLibrary() {
  const {
    clips,
    filteredClips,
    search,
    setSearch,
    playingId,
    playClip,
    renameClip,
    deleteClip,
    libraryNotice,
    assignHotkey,
    exportClip,
    importAudioFile,
  } = useClipLibraryContext()

  const { isListening, microphoneLabel, replayAudioSource, bufferedMs, openClipEditor } =
    useReplayBufferContext()

  const navigate = useNavigate()
  const { isPro } = useLicense()
  const [hotkeyTarget, setHotkeyTarget] = useState<string | null>(null)
  const [aiTarget, setAiTarget] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const deleteSourceRef = useRef<HTMLButtonElement | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importNotice, setImportNotice] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const aiClip = clips.find((c) => c.id === aiTarget)
  const targetClip = clips.find((c) => c.id === hotkeyTarget)
  const deleteClipTarget = clips.find((c) => c.id === deleteTarget)

  function closeDeleteDialog() {
    const source = deleteSourceRef.current
    setDeleteTarget(null)
    queueMicrotask(() => source?.focus())
  }

  async function handleAddClipFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const result = await importAudioBatch(fileList, importAudioFile, (fileName, existingName) =>
      window.confirm(
        `"${fileName}" looks like it was already imported as "${existingName}". Import another copy anyway?`,
      ),
    )
    setImportError(result.error)
    setImportNotice(result.notice)
  }

  const sourceLabel =
    replayAudioSource === 'system'
      ? 'System audio'
      : replayAudioSource === 'virtual'
        ? 'Virtual device'
        : 'Microphone'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Clips</h1>
          <p className="page-desc">
            Capture moments from the rolling replay buffer, trim with a live playhead, and manage
            your library.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isListening ? (
            <span className="badge-live">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-clip" />
              Buffer live
            </span>
          ) : (
            <span className="badge-idle">Buffer idle</span>
          )}
          <span className="badge-accent" title={microphoneLabel ?? undefined}>
            {sourceLabel}
          </span>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="btn-secondary !py-2 !text-xs"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Clip
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".mp3,.wav,audio/mpeg,audio/wav,audio/wave,audio/x-wav"
            multiple
            className="hidden"
            onChange={(event) => {
              void handleAddClipFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </div>
      </div>

      <RecorderPanel />

      <section className="panel overflow-hidden" data-tour={TOUR_TARGET.clipLibrary}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4 sm:px-6">
          <div>
            <h2 className="section-title">Clip library</h2>
            <p className="helper-text mt-1">
              {filteredClips.length} clip{filteredClips.length === 1 ? '' : 's'}
              {bufferedMs > 0 ? ` · ${Math.round(bufferedMs / 1000)}s in buffer` : ''}
            </p>
          </div>
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clips or hotkeys…"
              className="field-input py-2 pl-9"
            />
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {libraryNotice ? (
            <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {libraryNotice}
            </p>
          ) : null}
          {importError || importNotice ? (
            <p
              className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                importError
                  ? 'border-red-500/30 bg-red-500/10 text-red-200'
                  : 'border-clip/25 bg-clip/10 text-clip-hover'
              }`}
            >
              {importError ?? importNotice}
            </p>
          ) : null}
          {clipLibraryLoadError() ? (
            <p className="mb-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {clipLibraryLoadError()}
            </p>
          ) : null}
          {filteredClips.length === 0 ? (
            <div className="empty-state">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent-hover">
                <FilmIcon className="h-7 w-7" />
              </div>
              <h3 className="section-title">No clips found</h3>
              <p className="mx-auto mt-2 max-w-sm helper-text">
                {search
                  ? 'Try a different search term or clear the filter.'
                  : 'Hit the green Clip button above or add a clip manually to get started.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredClips.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  isPlaying={playingId === clip.id}
                  onPlay={() => void playClip(clip.id)}
                  onRename={(name) => renameClip(clip.id, name)}
                  onDelete={(source) => {
                    deleteSourceRef.current = source
                    setDeleteTarget(clip.id)
                  }}
                  onAssignHotkey={() => setHotkeyTarget(clip.id)}
                  onExport={() => void exportClip(clip.id)}
                  onTrim={() => void openClipEditor(clip.id)}
                  onAIClone={() => {
                    if (!isPro) {
                      navigate('/settings', { state: upgradeNavigationState() })
                      return
                    }
                    setAiTarget(clip.id)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {aiClip && (
        <AIVoiceDialog
          clip={aiClip}
          existingNames={clips.map((clip) => clip.name)}
          onClose={() => setAiTarget(null)}
          onSave={async (wav, name) => {
            const file = new File([wav], `${name}.wav`, { type: 'audio/wav' })
            const result = await importAudioFile(file, { allowDuplicate: true, aiGenerated: true })
            if (!result.ok) throw new Error(result.error)
          }}
        />
      )}

      {deleteClipTarget && (
        <DeleteClipDialog
          clipName={deleteClipTarget.name}
          onCancel={closeDeleteDialog}
          onConfirm={() => {
            const id = deleteClipTarget.id
            closeDeleteDialog()
            void deleteClip(id)
          }}
        />
      )}

      {targetClip && (
        <HotkeyDialog
          clipId={targetClip.id}
          clipName={targetClip.name}
          currentHotkey={targetClip.hotkey}
          clips={clips}
          onSave={(hotkey) => {
            assignHotkey(targetClip.id, hotkey)
            setHotkeyTarget(null)
          }}
          onClose={() => setHotkeyTarget(null)}
        />
      )}
    </div>
  )
}
