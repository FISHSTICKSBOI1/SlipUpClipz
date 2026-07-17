import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAppSettings } from '../context/AppSettingsContext'
import { QUICK_TIP_ROTATE_MS, QUICK_TIPS } from '../data/quickTips'
import {
  HomeIcon,
  FilmIcon,
  Squares2X2Icon,
  Cog6ToothIcon,
} from './icons'

const navItems = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/clips', label: 'Clips', icon: FilmIcon },
  { to: '/soundboard', label: 'Soundboard', icon: Squares2X2Icon },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon },
]

export function Sidebar() {
  const { settings } = useAppSettings()
  const compact = settings.compactSidebar
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    if (compact || QUICK_TIPS.length <= 1) return
    const timer = window.setInterval(() => {
      setTipIndex((current) => (current + 1) % QUICK_TIPS.length)
    }, QUICK_TIP_ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [compact])

  const tip = QUICK_TIPS[tipIndex] ?? QUICK_TIPS[0]

  return (
    <aside
      className={`app-sidebar transition-[width] duration-200 ${
        compact ? 'w-[4.75rem]' : 'w-60 lg:w-64 xl:w-[17rem]'
      }`}
    >
      <div
        className={`flex items-center border-b border-white/5 ${
          compact ? 'h-[4.25rem] justify-center px-2' : 'h-[4.25rem] gap-3 px-5'
        }`}
      >
        <div className="relative shrink-0">
          <img
            src="./app-icon.png"
            alt="SlipUpClipz"
            className="h-10 w-10 rounded-xl shadow-[0_0_20px_rgba(124,92,255,0.35)] ring-1 ring-white/10"
            width={40}
            height={40}
            draggable={false}
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-clip ring-2 ring-[#0a0c14]" />
        </div>
        {!compact && (
          <div className="min-w-0">
            <p className="app-brand truncate">SlipUpClipz</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              Gaming utility
            </p>
          </div>
        )}
      </div>

      <nav className={`flex-1 space-y-1.5 ${compact ? 'p-2.5' : 'p-3.5'}`}>
        {!compact && (
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint">
            Main
          </p>
        )}
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            aria-label={label}
            className={({ isActive }) =>
              `nav-link ${compact ? 'justify-center px-2' : ''} ${isActive ? 'nav-link-active' : ''}`
            }
          >
            <Icon className="h-5 w-5 shrink-0 opacity-90" />
            {!compact && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={`border-t border-white/5 ${compact ? 'p-2.5' : 'space-y-3 p-4'}`}>
        {!compact && (
          <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/15 via-[#141824] to-accent-blue/10 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-hover">
              Quick tip
            </p>
            <p
              key={tip}
              className="mt-2 text-xs leading-relaxed text-ink-soft/90 transition-opacity duration-300"
            >
              {tip}
            </p>
          </div>
        )}
        <div
          className={`flex items-center ${
            compact ? 'justify-center' : 'justify-between gap-2 px-1'
          }`}
        >
          <span className="badge-accent">v0.1.3</span>
          {!compact && <span className="text-[10px] font-medium text-ink-faint">Desktop</span>}
        </div>
      </div>
    </aside>
  )
}
