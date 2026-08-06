import { SITE } from '../config/site'

type MicrosoftStoreButtonProps = {
  className?: string
  variant?: 'primary' | 'secondary'
  label?: string
}

/**
 * External Microsoft Store CTA. Uses the shared SITE.microsoftStoreUrl config.
 * Opens in a new tab as a normal web link (not React Router, not ms-windows-store://).
 */
export function MicrosoftStoreButton({
  className = '',
  variant = 'secondary',
  label = 'Get it from Microsoft Store',
}: MicrosoftStoreButtonProps) {
  const variantClasses =
    variant === 'primary'
      ? 'bg-gradient-to-r from-glow-purple to-glow-magenta text-white shadow-glow hover:brightness-110'
      : 'border border-ink-border bg-ink-panel/70 text-slate-100 hover:border-glow-purple/60 hover:bg-ink-panel'

  return (
    <a
      href={SITE.microsoftStoreUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get SlipUpClipz from the Microsoft Store (opens in a new tab)"
      className={`btn-lift inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow-purple ${variantClasses} ${className}`}
    >
      <StoreIcon className="h-4 w-4 shrink-0 opacity-90" />
      <span>{label}</span>
    </a>
  )
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 3h8.5v8.5H3V3zm9.5 0H21v8.5h-8.5V3zM3 12.5H11.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z" />
    </svg>
  )
}
