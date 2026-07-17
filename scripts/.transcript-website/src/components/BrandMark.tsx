import { Link } from 'react-router-dom'
import { SITE } from '../config/site'

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <Link
      to={SITE.paths.home}
      className={`group inline-flex items-center gap-3 ${className}`}
      aria-label="SlipUpClipz home"
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-glow-purple via-glow-magenta to-glow-blue text-sm font-extrabold text-white shadow-glow"
        aria-hidden
      >
        SU
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-white group-hover:text-slate-100">
        SlipUpClipz
      </span>
    </Link>
  )
}
