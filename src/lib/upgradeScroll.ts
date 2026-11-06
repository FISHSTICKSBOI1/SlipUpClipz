/** Scroll the settings pane so the license section sits below the fixed header. */
export function scrollLicenseSectionIntoView(section: HTMLElement): void {
  const scroller = section.closest('.app-main')
  if (!(scroller instanceof HTMLElement)) {
    section.scrollIntoView({ block: 'start', behavior: 'smooth' })
    return
  }

  const top =
    section.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
  scroller.scrollTo({ top: Math.max(0, top - 16), behavior: 'smooth' })
}
