export const AI_VOICE_SECTION_ID = 'ai-voice-cloning'

export function scrollBehavior(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? 'auto' : 'smooth'
}

export function sectionFromHash(hash: string): string | null {
  if (!hash.startsWith('#') || hash.length < 2) return null
  try { return decodeURIComponent(hash.slice(1)) } catch { return null }
}

const highlights = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>()
export function scrollToSection(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: scrollBehavior(reduced), block: 'start' })
  // Focus the destination for keyboard users, without a second scroll.
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  if (id === 'feedback') {
    clearTimeout(highlights.get(target))
    target.classList.add('anchor-highlight')
    highlights.set(target, setTimeout(() => target.classList.remove('anchor-highlight'), 3000))
  }
}

export function scrollToAiVoice() { scrollToSection(AI_VOICE_SECTION_ID) }
