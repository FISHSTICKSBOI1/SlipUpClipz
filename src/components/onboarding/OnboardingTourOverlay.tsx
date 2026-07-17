import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CLIP_RECORD_HOTKEY } from '@shared/appTypes'
import { useAppSettings } from '../../context/AppSettingsContext'
import { useOnboardingTour } from '../../context/OnboardingTourContext'
import { useAudioOutputDevices } from '../../hooks/useAudioOutputDevices'
import { EXTERNAL_LINKS, openExternalLink } from '../../lib/externalLinks'
import { getTourTargetElement, type TourTargetId } from '../../lib/onboardingTour'

type SpotlightRect = {
  top: number
  left: number
  width: number
  height: number
}

type CardPosition = {
  top: number
  left: number
}

const PAD = 12
const CARD_WIDTH = 360

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function measureTarget(targetId: TourTargetId): SpotlightRect | null {
  const element = getTourTargetElement(targetId)
  if (!element) return null
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

function placeCard(
  spotlight: SpotlightRect | null,
  centered: boolean,
): CardPosition {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const cardHeight = 280

  if (centered || !spotlight) {
    return {
      top: Math.max(PAD, (viewportHeight - cardHeight) / 2),
      left: Math.max(PAD, (viewportWidth - CARD_WIDTH) / 2),
    }
  }

  const belowTop = spotlight.top + spotlight.height + PAD + 8
  const aboveTop = spotlight.top - cardHeight - PAD
  const preferBelow = belowTop + cardHeight < viewportHeight - PAD
  const top = preferBelow
    ? belowTop
    : aboveTop > PAD
      ? aboveTop
      : clamp(spotlight.top, PAD, viewportHeight - cardHeight - PAD)

  const left = clamp(
    spotlight.left + spotlight.width / 2 - CARD_WIDTH / 2,
    PAD,
    viewportWidth - CARD_WIDTH - PAD,
  )

  return { top, left }
}

export function OnboardingTourOverlay() {
  const {
    isActive,
    step,
    hotkeyAcknowledged,
    exitConfirmOpen,
    nextStep,
    backStep,
    skipTour,
    finishTour,
    acknowledgeHotkey,
    requestExit,
    cancelExit,
    confirmExit,
  } = useOnboardingTour()
  const { settings } = useAppSettings()
  const { hasVirtualOutput, isLoading: devicesLoading } = useAudioOutputDevices()

  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const [cardPos, setCardPos] = useState<CardPosition>({ top: 80, left: 80 })

  const refreshLayout = useCallback(() => {
    if (!step) return
    const centered = step.placement === 'center' || !step.targetId
    const nextSpotlight = step.targetId ? measureTarget(step.targetId) : null
    setSpotlight(nextSpotlight)
    setCardPos(placeCard(nextSpotlight, centered))

    if (step.targetId) {
      getTourTargetElement(step.targetId)?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      })
    }
  }, [step])

  useLayoutEffect(() => {
    if (!isActive || !step) return
    refreshLayout()
    const timer = window.setTimeout(refreshLayout, 120)
    const timer2 = window.setTimeout(refreshLayout, 400)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(timer2)
    }
  }, [isActive, refreshLayout, step])

  useEffect(() => {
    if (!isActive) return

    function onResize() {
      refreshLayout()
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [isActive, refreshLayout])

  useEffect(() => {
    if (!isActive) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return

      // Let hotkey capture UI consume Escape first.
      if (document.querySelector('[data-hotkey-capture="true"]')) {
        return
      }

      event.preventDefault()
      if (exitConfirmOpen) {
        cancelExit()
      } else {
        requestExit()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cancelExit, exitConfirmOpen, isActive, requestExit])

  if (!isActive || !step) {
    return null
  }

  const isWelcome = step.id === 'welcome'
  const isFinal = Boolean(step.isFinal)
  const isCentered = step.placement === 'center' || !step.targetId
  const nextDisabled = Boolean(step.requireHotkeyAck && !hotkeyAcknowledged)
  const showVirtualMissingHint =
    step.id === 'audio-setup' && !devicesLoading && !hasVirtualOutput

  const overlay = (
    <div className="fixed inset-0 z-[1000]" aria-live="polite">
      {isCentered || !spotlight ? (
        <div className="absolute inset-0 bg-black/70 transition-opacity duration-300" />
      ) : (
        <>
          {/* Four-panel dim so only the highlighted region stays clickable */}
          <div
            className="absolute left-0 right-0 top-0 bg-black/70 transition-all duration-300"
            style={{ height: Math.max(0, spotlight.top - 6) }}
          />
          <div
            className="absolute left-0 bg-black/70 transition-all duration-300"
            style={{
              top: Math.max(0, spotlight.top - 6),
              width: Math.max(0, spotlight.left - 6),
              height: spotlight.height + 12,
            }}
          />
          <div
            className="absolute right-0 bg-black/70 transition-all duration-300"
            style={{
              top: Math.max(0, spotlight.top - 6),
              left: spotlight.left + spotlight.width + 6,
              height: spotlight.height + 12,
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 bg-black/70 transition-all duration-300"
            style={{
              top: spotlight.top + spotlight.height + 6,
            }}
          />
          <div
            className="pointer-events-none absolute rounded-xl border-2 border-accent transition-all duration-300 ease-out"
            style={{
              top: spotlight.top - 6,
              left: spotlight.left - 6,
              width: spotlight.width + 12,
              height: spotlight.height + 12,
              boxShadow: '0 0 24px rgba(16,185,129,0.35)',
            }}
          />
        </>
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-tour-title"
        className="absolute z-[1001] w-[min(360px,calc(100vw-24px))] rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-2xl transition-all duration-300 ease-out"
        style={{ top: cardPos.top, left: cardPos.left }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="onboarding-tour-title" className="text-base font-semibold text-white">
              {step.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">{step.description}</p>
          </div>
        </div>

        {step.id === 'clips-overview' && (
          <ul className="mb-4 space-y-1.5 text-xs text-gray-400">
            <li>
              Look for the green <span className="text-emerald-300">Clip</span> button to save the
              buffer.
            </li>
            <li>Replay-buffer status appears near the top of this panel.</li>
            <li>Buffer duration is controlled by the Buffer length slider.</li>
          </ul>
        )}

        {step.id === 'clip-hotkey' && (
          <div className="mb-4 space-y-3 rounded-lg border border-surface-border bg-surface-overlay/50 p-3">
            <p className="text-xs text-gray-400">
              Current shortcut:{' '}
              <span className="font-mono text-gray-200">
                {settings.clipHotkey || CLIP_RECORD_HOTKEY}
              </span>
            </p>
            <p className="text-[11px] text-gray-500">
              Record a new shortcut in the highlighted control, or keep the default.
            </p>
            {!hotkeyAcknowledged ? (
              <button
                type="button"
                onClick={acknowledgeHotkey}
                className="rounded-lg border border-accent/40 bg-accent/15 px-3 py-2 text-xs font-medium text-accent-hover transition-colors hover:bg-accent/25"
              >
                {settings.clipHotkey === CLIP_RECORD_HOTKEY || !settings.clipHotkey
                  ? 'Keep default hotkey'
                  : 'Use this hotkey'}
              </button>
            ) : (
              <p className="text-xs font-medium text-emerald-400">Hotkey confirmed</p>
            )}
          </div>
        )}

        {step.id === 'replay-source' && (
          <ul className="mb-4 space-y-1.5 text-xs text-gray-400">
            <li>
              <span className="text-gray-200">Microphone</span> — capture your voice input.
            </li>
            <li>
              <span className="text-gray-200">System audio</span> — capture game and Discord sound
              when available.
            </li>
            <li>
              <span className="text-gray-200">Virtual device</span> — capture from VB-Cable or
              VoiceMeeter.
            </li>
          </ul>
        )}

        {step.id === 'audio-setup' && (
          <ul className="mb-4 space-y-1.5 text-xs text-gray-400">
            <li>Microphone volume controls the live mic level.</li>
            <li>Soundboard volume controls clip playback level.</li>
            <li>Mic On/Off controls whether the live microphone is sent to the virtual output.</li>
            <li>Hear Myself controls whether you hear monitored audio locally.</li>
            <li>
              The virtual output is the device selected in Discord or the game as the microphone
              input.
            </li>
            {showVirtualMissingHint && (
              <li className="text-amber-300">
                Virtual audio routing is not configured yet. You can finish this later in the
                Soundboard audio controls.
              </li>
            )}
          </ul>
        )}

        {step.id === 'soundboard-pads' && (
          <ul className="mb-4 space-y-1.5 text-xs text-gray-400">
            <li>Add a saved clip to an empty pad.</li>
            <li>Import MP3 or WAV from your library flow when available.</li>
            <li>Rename, assign a hotkey, play, or replace pads anytime.</li>
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {isWelcome ? (
            <>
              <button
                type="button"
                onClick={nextStep}
                className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Start Tour
              </button>
              <button
                type="button"
                onClick={() => void skipTour()}
                className="rounded-lg px-3 py-2 text-xs font-medium text-gray-400 transition-colors hover:text-gray-200"
              >
                Skip Tour
              </button>
            </>
          ) : isFinal ? (
            <>
              <button
                type="button"
                onClick={() => void finishTour()}
                className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Finish
              </button>
              <button
                type="button"
                onClick={() => openExternalLink(EXTERNAL_LINKS.helpCenter)}
                className="rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:border-accent hover:text-white"
              >
                Open Help Center
              </button>
            </>
          ) : (
            <>
              {step.showBack && (
                <button
                  type="button"
                  onClick={backStep}
                  className="rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:text-white"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={nextStep}
                disabled={nextDisabled}
                className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => void skipTour()}
                className="ml-auto rounded-lg px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:text-gray-300"
              >
                Skip Tour
              </button>
            </>
          )}
        </div>
      </div>

      {exitConfirmOpen && (
        <div className="absolute inset-0 z-[1002] flex items-center justify-center bg-black/50 p-4">
          <div
            role="alertdialog"
            aria-labelledby="exit-tour-title"
            className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-2xl"
          >
            <h3 id="exit-tour-title" className="text-sm font-semibold text-white">
              Exit the guided tour?
            </h3>
            <p className="mt-2 text-xs text-gray-400">
              You can restart it anytime from Settings → Help &amp; Support.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void confirmExit()}
                className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Exit tour
              </button>
              <button
                type="button"
                onClick={cancelExit}
                className="rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:text-white"
              >
                Continue tour
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(overlay, document.body)
}
