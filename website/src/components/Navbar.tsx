import { useEffect, useId, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { BrandMark } from './BrandMark'
import { Button } from './Button'
import { SITE } from '../config/site'

const NAV = [
  { to: SITE.paths.features, label: 'Features' },
  { to: SITE.paths.howItWorks, label: 'How It Works' },
  { to: SITE.paths.pricing, label: 'Pricing' },
  { to: SITE.paths.help, label: 'Help' },
  { to: SITE.paths.changelog, label: 'Changelog' },
] as const

export function Navbar() {
  const [open, setOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-ink-border/60 bg-ink/70 backdrop-blur-xl">
      <div className="site-container flex min-h-[4.25rem] items-center justify-between gap-4">
        <BrandMark />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-ink-panel text-white'
                    : 'text-slate-400 hover:bg-ink-panel/60 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Button href={SITE.downloadUrl} className="btn-lift !py-2.5 !text-xs">
            Download for Windows
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-ink-border px-3 py-2 text-sm text-slate-200 transition hover:bg-ink-panel lg:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      <div
        id={menuId}
        className={`overflow-hidden border-t border-ink-border bg-ink-raised transition-[max-height,opacity] duration-300 lg:hidden ${
          open ? 'max-h-96 opacity-100' : 'pointer-events-none max-h-0 opacity-0'
        }`}
      >
        <nav className="site-container flex flex-col gap-1 py-4" aria-label="Mobile">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-3 text-sm font-medium text-slate-200 hover:bg-ink-panel"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Button href={SITE.downloadUrl} className="btn-lift mt-2">
            Download for Windows
          </Button>
        </nav>
      </div>
    </header>
  )
}
