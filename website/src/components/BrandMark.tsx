import { Link } from 'react-router-dom'
import { SITE } from '../config/site'

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <Link
      to={SITE.paths.home}
      className={`group inline-flex items-center gap-3 ${className}`}
      aria-label="SlipUpClipz home"
    >
      <img
        src={SITE.logoUrl}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 rounded-xl shadow-glow"
        aria-hidden
      />
      <span className="font-display text-lg font-bold tracking-tight text-white group-hover:text-slate-100">
        SlipUpClipz
      </span>
    </Link>
  )
}
