export const AI_VOICE_SECTION_ID = 'ai-voice-cloning'

export function scrollBehavior(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? 'auto' : 'smooth'
}

export function scrollToSection(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({
    behavior: scrollBehavior(prefersReducedMotion),
    block: 'start',
  })
}

export function scrollToAiVoice() {
  scrollToSection(AI_VOICE_SECTION_ID)
}
