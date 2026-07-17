import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSettings } from './AppSettingsContext'
import {
  ONBOARDING_TOUR_STEPS,
  ONBOARDING_TOUR_VERSION,
  type TourStep,
  type TourStepId,
} from '../lib/onboardingTour'

type OnboardingTourContextValue = {
  isActive: boolean
  stepIndex: number
  step: TourStep | null
  hotkeyAcknowledged: boolean
  exitConfirmOpen: boolean
  startTour: () => void
  skipTour: () => Promise<void>
  finishTour: () => Promise<void>
  nextStep: () => void
  backStep: () => void
  acknowledgeHotkey: () => void
  requestExit: () => void
  cancelExit: () => void
  confirmExit: () => Promise<void>
}

const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(null)

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { settings, isLoading, updateSettings } = useAppSettings()
  const [isActive, setIsActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [hotkeyAcknowledged, setHotkeyAcknowledged] = useState(false)
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const [hasAutoStarted, setHasAutoStarted] = useState(false)
  const [hotkeyBaseline, setHotkeyBaseline] = useState<string | null>(null)

  const step = isActive ? ONBOARDING_TOUR_STEPS[stepIndex] ?? null : null

  const persistCompleted = useCallback(async () => {
    await updateSettings({ onboardingCompletedVersion: ONBOARDING_TOUR_VERSION })
  }, [updateSettings])

  const goToStep = useCallback(
    (index: number) => {
      const next = ONBOARDING_TOUR_STEPS[index]
      if (!next) return
      setStepIndex(index)
      setHotkeyAcknowledged(false)
      setExitConfirmOpen(false)
      setHotkeyBaseline(next.requireHotkeyAck ? settings.clipHotkey || '' : null)
      if (next.route) {
        navigate(next.route)
      }
    },
    [navigate, settings.clipHotkey],
  )

  const startTour = useCallback(() => {
    setIsActive(true)
    setExitConfirmOpen(false)
    setHotkeyAcknowledged(false)
    setStepIndex(0)
  }, [])

  const endTour = useCallback(async () => {
    setIsActive(false)
    setExitConfirmOpen(false)
    setHotkeyAcknowledged(false)
    setStepIndex(0)
    await persistCompleted()
  }, [persistCompleted])

  const skipTour = useCallback(async () => {
    await endTour()
  }, [endTour])

  const finishTour = useCallback(async () => {
    await endTour()
  }, [endTour])

  const nextStep = useCallback(() => {
    if (!step) return
    if (step.requireHotkeyAck && !hotkeyAcknowledged) return

    if (step.id === 'welcome') {
      goToStep(1)
      return
    }

    if (step.isFinal) {
      void finishTour()
      return
    }

    const nextIndex = stepIndex + 1
    if (nextIndex >= ONBOARDING_TOUR_STEPS.length) {
      void finishTour()
      return
    }
    goToStep(nextIndex)
  }, [finishTour, goToStep, hotkeyAcknowledged, step, stepIndex])

  const backStep = useCallback(() => {
    if (stepIndex <= 0) return
    goToStep(stepIndex - 1)
  }, [goToStep, stepIndex])

  const acknowledgeHotkey = useCallback(() => {
    setHotkeyAcknowledged(true)
  }, [])

  const requestExit = useCallback(() => {
    setExitConfirmOpen(true)
  }, [])

  const cancelExit = useCallback(() => {
    setExitConfirmOpen(false)
  }, [])

  const confirmExit = useCallback(async () => {
    await skipTour()
  }, [skipTour])

  useEffect(() => {
    if (!isActive || !step?.requireHotkeyAck || hotkeyAcknowledged) return
    if (hotkeyBaseline === null) return
    if ((settings.clipHotkey || '') !== hotkeyBaseline) {
      setHotkeyAcknowledged(true)
    }
  }, [
    hotkeyAcknowledged,
    hotkeyBaseline,
    isActive,
    settings.clipHotkey,
    step?.requireHotkeyAck,
  ])

  useEffect(() => {
    if (isLoading || hasAutoStarted) return
    setHasAutoStarted(true)
    if (settings.onboardingCompletedVersion < ONBOARDING_TOUR_VERSION) {
      startTour()
    }
  }, [hasAutoStarted, isLoading, settings.onboardingCompletedVersion, startTour])

  useEffect(() => {
    if (!isActive || !step?.route) return
    navigate(step.route)
  }, [isActive, navigate, step?.id, step?.route])

  const value = useMemo<OnboardingTourContextValue>(
    () => ({
      isActive,
      stepIndex,
      step,
      hotkeyAcknowledged,
      exitConfirmOpen,
      startTour,
      skipTour,
      finishTour,
      nextStep,
      backStep,
      acknowledgeHotkey,
      requestExit,
      cancelExit,
      confirmExit,
    }),
    [
      acknowledgeHotkey,
      backStep,
      cancelExit,
      confirmExit,
      exitConfirmOpen,
      finishTour,
      hotkeyAcknowledged,
      isActive,
      nextStep,
      requestExit,
      skipTour,
      startTour,
      step,
      stepIndex,
    ],
  )

  return (
    <OnboardingTourContext.Provider value={value}>{children}</OnboardingTourContext.Provider>
  )
}

export function useOnboardingTour() {
  const context = useContext(OnboardingTourContext)
  if (!context) {
    throw new Error('useOnboardingTour must be used within OnboardingTourProvider')
  }
  return context
}

export type { TourStepId }
