import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { BrandMark } from './BrandMark'
import { Button } from './Button'
import { SITE } from '../config/site'

const GROUPS = [
  { label: 'Explore', note: 'One moment. Endless replays.', links: [
    { to: SITE.paths.features, label: 'Features', detail: 'Clipping, soundboard, effects & more', icon: '✦' },
    { to: SITE.paths.howItWorks, label: 'How it works', detail: 'From first capture to instant replay', icon: '↗' },
    { to: '/#ai-voice-cloning', label: 'Local AI Voice Cloning', detail: 'Windows installer · Pro · NVIDIA GPU', icon: '≈' },
    { to: '/#demo', label: 'Watch the demo', detail: 'See the real app in action', icon: '▷' },
  ] },
  { label: 'Resources', note: 'Get set up. Get back to the game.', links: [
    { to: SITE.paths.help, label: 'Help Center', detail: 'Setup guides & troubleshooting', icon: '?' },
    { to: SITE.paths.faq, label: 'FAQ', detail: 'Quick answers to common questions', icon: '↳' },
    { to: SITE.paths.changelog, label: 'Changelog', detail: 'What’s new in SlipUpClipz', icon: '↻' },
    { to: SITE.paths.contact, label: 'Contact Support', detail: 'A little help when you need it', icon: '✉' },
  ] },
] as const

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const header = useRef<HTMLElement>(null)
  const mobileButton = useRef<HTMLButtonElement>(null)
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const id = useId()
  const location = useLocation()
  function clearTimer() { clearTimeout(timer.current) }
  function close() { clearTimer(); setActive(null); setMobileOpen(false) }

  useEffect(() => { close() }, [location.key])
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!header.current?.contains(event.target as Node)) close()
    }
    function resize() { close() }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', resize)
    return () => {
      clearTimer()
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || (!active && !mobileOpen)) return
      event.preventDefault(); clearTimer()
      if (active) { triggers.current[active]?.focus(); setActive(null) }
      else { setMobileOpen(false); mobileButton.current?.focus() }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [active, mobileOpen])

  return (<>
    <header ref={header} className="site-header" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) close()
    }}>
      <div className="site-container nav-shell">
        <BrandMark />
        <button ref={mobileButton} type="button" className="nav-mobile-toggle" aria-expanded={mobileOpen}
          aria-controls={id} onClick={() => { setMobileOpen(!mobileOpen); setActive(null) }}>
          {mobileOpen ? 'Close menu' : 'Menu'} <span aria-hidden>{mobileOpen ? '×' : '☰'}</span>
        </button>
        <nav id={id} className={`primary-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Primary">
          {GROUPS.map((group, index) => (
            <div key={group.label} className="nav-group" onPointerEnter={(event) => {
              if (event.pointerType === 'mouse' && window.matchMedia('(min-width: 1024px)').matches) {
                clearTimer(); setActive(group.label)
              }
            }} onPointerLeave={() => {
              clearTimer()
              timer.current = setTimeout(() => {
                if (!triggers.current[group.label]?.parentElement?.contains(document.activeElement)) setActive(null)
              }, 160)
            }}>
              <button ref={(el) => { triggers.current[group.label] = el }} type="button" className="nav-link"
                aria-expanded={active === group.label} aria-controls={`${id}-${index}`}
                onClick={() => { clearTimer(); setActive(active === group.label ? null : group.label) }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault(); clearTimer(); setActive(group.label)
                    requestAnimationFrame(() => document.getElementById(`${id}-${index}`)?.querySelector('a')?.focus())
                  }
                }}>
                {group.label} <span className="nav-chevron" aria-hidden>⌄</span>
              </button>
              <div id={`${id}-${index}`} className="nav-dropdown" hidden={active !== group.label}>
                <p className="nav-note">{group.note}</p>
                <div className="nav-destinations">
                  {group.links.map((link) => <Link key={link.to} to={link.to} onClick={close}>
                    <span className="nav-icon" aria-hidden>{link.icon}</span>
                    <span><strong>{link.label}</strong><small>{link.detail}</small></span>
                    <span aria-hidden>↗</span>
                  </Link>)}
                </div>
              </div>
            </div>
          ))}
          <NavLink to={SITE.paths.pricing} className="nav-link" onClick={close}>Pricing</NavLink>
          <Link to={`${SITE.paths.pricing}#manage`} className="nav-link" onClick={close}>Manage Pro</Link>
          <Button href={SITE.downloadUrl} className="nav-download">Download for Windows <span aria-hidden>↓</span></Button>
        </nav>
      </div>
    </header>
    {(active || mobileOpen) && <div className="nav-backdrop" aria-hidden="true" />}
  </>)
}
