import { useEffect } from 'react'
import type { ReplayAudioSource } from '@shared/appTypes'
import {
  DEFAULT_BUFFER_SECONDS,
  MAX_BUFFER_SECONDS,
  MIC_TEST_SECONDS,
  MIN_BUFFER_SECONDS,
} from '../../hooks/useReplayBuffer'
import { useAppSettings } from '../../context/AppSettingsContext'
import { useReplayBufferContext } from '../../context/ReplayBufferContext'
import { formatDuration } from '../../lib/format'
import { shouldIgnoreGlobalHotkey } from '../../lib/hotkey'
import { MicrophoneIcon, ScissorsIcon } from '../icons'
import { ClipHotkeyControl } from './ClipHotkeyControl'
import { ReplayAudioSourceControl } from './ReplayAudioSourceControl'
import { TrimEditor } from './TrimEditor'
import { TOUR_TARGET } from '../../lib/onboardingTour'

function replaySourceLabels(source: ReplayAudioSource) {
  switch (source) {
    case 'system':
      return {
        description:
          'System audio is captured continuously (game, Discord, system sounds), even when SlipUpClipz is minimized.',
        requesting: 'Starting system audio capture...',
        idle: 'System audio not active',
        inputLabel: 'Audio source',
        levelLabel: 'Live system audio level',
        levelHint:
          'Play audio on your PC. The meter should move when system sounds are detected.',
        showMicTest: false,
      }
    case 'virtual':
      return {
        description:
          'Virtual device audio is captured continuously, even when SlipUpClipz is minimized.',
        requesting: 'Connecting to virtual audio device...',
        idle: 'Virtual audio not active',
        inputLabel: 'Virtual input',
        levelLabel: 'Live audio level',
        levelHint:
          'Route game and chat audio into your virtual device. The meter should move when audio is flowing.',
        showMicTest: false,
      }
    default:
      return {
        description:
          'Microphone audio is captured continuously, even when SlipUpClipz is minimized.',
        requesting: 'Requesting microphone access...',
        idle: 'Microphone not active',
        inputLabel: 'Input device',
        levelLabel: 'Live input level',
        levelHint:
          'Speak normally. The meter should move when your microphone is receiving audio.',
        showMicTest: true,
      }
  }
}

export function RecorderPanel() {
  const { updateSettings } = useAppSettings()
  const {
    bufferLengthSec,
    setBufferLengthSec,
    bufferedMs,
    isListening,
    isRequestingMic,
    microphoneLabel,
    micLevelPercent,
    isTestingMic,
    micTestMessage,
    testMicrophone,
    error,
    editingClip,
    isSaving,
    lastSavedName,
    clipHotkey,
    replayAudioSource,
    handleClip,
    handleSaveTrimmed,
    handleCloseEditor,
  } = useReplayBufferContext()

  const labels = replaySourceLabels(replayAudioSource)

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

      if (pressed === clipHotkey) {
        event.preventDefault()
        void handleClip()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clipHotkey, handleClip])

  const bufferPercent =
    bufferLengthSec <= 0
      ? bufferedMs > 0
        ? 100
        : 0
      : Math.min(100, (bufferedMs / (bufferLengthSec * 1000)) * 100)

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden" data-tour={TOUR_TARGET.clipsOverview}>
        <div className="border-b border-white/5 bg-gradient-to-r from-accent/15 via-transparent to-clip/10 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="control-label text-accent-hover">Replay capture</p>
              <h2 className="page-subtitle mt-1">Instant replay buffer</h2>
              <p className="section-desc max-w-2xl">{labels.description}</p>
            </div>

            {isRequestingMic && (
              <span className="badge-idle">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted" />
                {labels.requesting}
              </span>
            )}

            {isListening && microphoneLabel && (
              <span className="badge-live">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-clip" />
                Listening · {formatDuration(bufferedMs)} buffered
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 px-5 py-5 lg:grid-cols-[1.1fr_0.9fr] sm:px-6">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-clip/20 bg-gradient-to-b from-clip/10 to-transparent px-6 py-8 text-center">
            <button
              type="button"
              onClick={() => void handleClip()}
              disabled={!isListening || isSaving || isTestingMic}
              className="btn-clip min-w-[10rem]"
            >
              <ScissorsIcon className="h-5 w-5" />
              Clip
            </button>
            <p className="mt-4 text-sm font-medium text-ink-soft">
              Hotkey{' '}
              <kbd className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-xs text-white">
                {clipHotkey}
              </kbd>
            </p>
            {!isListening && !isRequestingMic && !error && (
              <p className="mt-2 inline-flex items-center gap-1.5 helper-text">
                <MicrophoneIcon className="h-3.5 w-3.5" />
                {labels.idle}
              </p>
            )}
            {isSaving && !editingClip && (
              <p className="mt-2 helper-text">Saving clip to library...</p>
            )}
          </div>

          <div className="space-y-4">
            {isListening && microphoneLabel && (
              <div className="panel-inset space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-ink-soft">
                    <MicrophoneIcon className="h-4 w-4 text-clip-hover" />
                    <span className="font-semibold">{labels.inputLabel}</span>
                  </div>
                  <span
                    className="max-w-full truncate text-xs text-clip-hover"
                    title={microphoneLabel}
                  >
                    {microphoneLabel}
                  </span>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[10px] text-ink-faint">
                    <span>{labels.levelLabel}</span>
                    <span>{micLevelPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/40">
                    <div
                      className="h-full rounded-full bg-clip transition-[width] duration-75"
                      style={{ width: `${micLevelPercent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-ink-faint">{labels.levelHint}</p>
                </div>

                {labels.showMicTest && (
                  <button
                    type="button"
                    onClick={() => void testMicrophone()}
                    disabled={isTestingMic || isSaving}
                    className="btn-secondary !px-3 !py-2 !text-xs"
                  >
                    <MicrophoneIcon className="h-3.5 w-3.5" />
                    {isTestingMic ? `Testing (${MIC_TEST_SECONDS}s)...` : 'Test Microphone'}
                  </button>
                )}

                {labels.showMicTest && micTestMessage && (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                    {micTestMessage}
                  </p>
                )}
              </div>
            )}

            <div className="panel-inset space-y-4 p-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="buffer-length" className="control-label">
                    Buffer length
                  </label>
                  <span className="text-xs tabular-nums text-ink-soft">
                    {bufferLengthSec === 0 ? 'Instant' : `${bufferLengthSec}s`}
                  </span>
                </div>

                <input
                  id="buffer-length"
                  type="range"
                  min={MIN_BUFFER_SECONDS}
                  max={MAX_BUFFER_SECONDS}
                  step={1}
                  value={bufferLengthSec}
                  onChange={(e) => setBufferLengthSec(Number(e.target.value))}
                  className="mt-2 w-full accent-accent disabled:opacity-50"
                />

                <div className="mt-1 flex justify-between text-[10px] text-ink-faint">
                  <span>{MIN_BUFFER_SECONDS}s</span>
                  <span>{DEFAULT_BUFFER_SECONDS}s default</span>
                  <span>{MAX_BUFFER_SECONDS}s</span>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-[10px] text-ink-faint">
                  <span>Buffer fill</span>
                  <span>{Math.round(bufferPercent)}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-clip transition-all duration-300"
                    style={{ width: `${bufferPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t border-white/5 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <div data-tour={TOUR_TARGET.clipHotkey} className="panel-inset p-4">
            <ClipHotkeyControl
              value={clipHotkey}
              onSave={(hotkey) => void updateSettings({ clipHotkey: hotkey })}
              compact
            />
          </div>
          <div data-tour={TOUR_TARGET.replaySource} className="panel-inset p-4">
            <ReplayAudioSourceControl />
          </div>
        </div>

        {error && (
          <p className="mx-5 mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 sm:mx-6">
            {error}
          </p>
        )}

        {lastSavedName && !editingClip && (
          <p className="mx-5 mb-5 rounded-xl border border-clip/25 bg-clip/10 px-3 py-2 text-xs text-clip-hover sm:mx-6">
            Updated &ldquo;{lastSavedName}&rdquo; in your clip library.
          </p>
        )}
      </section>

      {editingClip && (
        <TrimEditor
          clipName={editingClip.name}
          blob={editingClip.blob}
          onSave={(trimmed, name) => void handleSaveTrimmed(trimmed, name)}
          onCancel={handleCloseEditor}
          isSaving={isSaving}
        />
      )}
    </div>
  )
}
