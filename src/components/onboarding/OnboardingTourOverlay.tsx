import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CLIP_RECORD_HOTKEY } from '@shared/appTypes'
import { captureGoalPlan, captureGoalSettingsPatch, type CaptureGoal } from '@shared/setupGuide'
import { useAppSettings } from '../../context/AppSettingsContext'
import { useOnboardingTour } from '../../context/OnboardingTourContext'
import { useAudioOutputDevices } from '../../hooks/useAudioOutputDevices'
import { EXTERNAL_LINKS, openExternalLink } from '../../lib/externalLinks'
import { useModalScrim } from '../../hooks/useModalScrim'
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
  cardHeight: number,
): CardPosition {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const cardWidth = Math.min(CARD_WIDTH, viewportWidth - PAD * 2)
  const height = Math.min(Math.max(cardHeight, 160), viewportHeight - PAD * 2)

  if (centered || !spotlight) {
    return {
      top: Math.max(PAD, (viewportHeight - height) / 2),
      left: Math.max(PAD, (viewportWidth - cardWidth) / 2),
    }
  }

  const belowTop = spotlight.top + spotlight.height + PAD + 8
  const aboveTop = spotlight.top - height - PAD
  const preferBelow = belowTop + height < viewportHeight - PAD
  const top = preferBelow
    ? belowTop
    : aboveTop > PAD
      ? aboveTop
      : PAD

  const left = clamp(
    spotlight.left + spotlight.width / 2 - cardWidth / 2,
    PAD,
    Math.max(PAD, viewportWidth - cardWidth - PAD),
  )

  return {
    top: clamp(top, PAD, Math.max(PAD, viewportHeight - height - PAD)),
    left,
  }
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
  useModalScrim(0.7, Boolean(isActive && step))
  const { settings, updateSettings } = useAppSettings()
  const [goalMessage, setGoalMessage] = useState<string | null>(null)
  const { hasVirtualOutput, isLoading: devicesLoading } = useAudioOutputDevices()

  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const [cardPos, setCardPos] = useState<CardPosition>({ top: 80, left: 80 })
  const cardRef = useRef<HTMLDivElement>(null)

  const refreshLayout = useCallback(() => {
    if (!step) return
    const centered = step.placement === 'center' || !step.targetId
    const nextSpotlight = step.targetId ? measureTarget(step.targetId) : null
    setSpotlight(nextSpotlight)
    setCardPos(placeCard(nextSpotlight, centered, cardRef.current?.offsetHeight ?? 280))

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

  function chooseCaptureGoal(goal: CaptureGoal) {
    const plan = captureGoalPlan(goal)
    const patch = captureGoalSettingsPatch(goal)
    if (patch) void updateSettings(patch)
    setGoalMessage(plan.summary)
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
        ref={cardRef}
        aria-modal="true"
        aria-labelledby="onboarding-tour-title"
        className="absolute z-[1001] max-h-[calc(100vh-1.5rem)] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-2xl transition-all duration-300 ease-out"
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
          <div className="mb-4 space-y-2">
            {(
              [
                ['teammates', 'Record what I hear'],
                ['myself', 'Record my microphone'],
                ['both', 'Record myself and what I hear'],
              ] as const
            ).map(([goal, label]) => (
              <button
                key={goal}
                type="button"
                onClick={() => chooseCaptureGoal(goal)}
                className="block w-full rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-white hover:border-accent/40"
              >
                {label}
              </button>
            ))}
            {goalMessage && <p className="text-xs leading-relaxed text-ink-muted">{goalMessage}</p>}
          </div>
        )}

        {step.id === 'audio-setup' && (
          <ul className="mb-4 space-y-1.5 text-xs text-gray-400">
            <li>Choose the soundboard output at the top of the page.</li>
            <li>Hear Myself plays your microphone in those headphones.</li>
            <li>The Live Audio Mixer sends your microphone with the soundboard when you turn it on.</li>
            <li>Discord and the game still need their microphone set by you.</li>
            {showVirtualMissingHint && (
              <li className="text-amber-300">
                Virtual audio routing is not configured yet. You can finish this later in Settings.
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
