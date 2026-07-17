import { useState } from 'react'
import { useClipLibraryContext } from '../../context/ClipLibraryContext'
import { useReplayBufferContext } from '../../context/ReplayBufferContext'
import { FilmIcon, PlusIcon, SearchIcon } from '../icons'
import { ClipCard } from './ClipCard'
import { HotkeyDialog } from './HotkeyDialog'
import { RecorderPanel } from './RecorderPanel'

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
    assignHotkey,
    addClip,
    exportClip,
  } = useClipLibraryContext()

  const { isListening, microphoneLabel, replayAudioSource, bufferedMs, openClipEditor } =
    useReplayBufferContext()

  const [hotkeyTarget, setHotkeyTarget] = useState<string | null>(null)
  const targetClip = clips.find((c) => c.id === hotkeyTarget)

  function handleAddClip() {
    const name = window.prompt('Clip name')
    if (name) addClip(name)
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
          <button type="button" onClick={handleAddClip} className="btn-secondary !py-2 !text-xs">
            <PlusIcon className="h-3.5 w-3.5" />
            Add clip
          </button>
        </div>
      </div>

      <RecorderPanel />

      <section className="panel overflow-hidden">
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
                  onDelete={() => deleteClip(clip.id)}
                  onAssignHotkey={() => setHotkeyTarget(clip.id)}
                  onExport={() => void exportClip(clip.id)}
                  onTrim={() => void openClipEditor(clip.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

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
