const TRUST_POINTS = [
  'Available on Microsoft Store',
  'Windows 10 & 11',
  'Automatic updates',
  'Secure Stripe checkout',
] as const

/**
 * Subtle homepage trust strip. Does not claim Microsoft endorsement.
 */
export function StoreTrustCard() {
  return (
    <section className="border-y border-ink-border/70 bg-ink-raised/20" aria-label="Availability">
      <div className="site-container py-8 sm:py-10">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map((point) => (
            <li
              key={point}
              className="flex items-center gap-3 rounded-xl border border-ink-border/60 bg-ink-panel/40 px-4 py-3 text-sm text-slate-300"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-glow-purple/15 text-glow-magenta"
                aria-hidden="true"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.42l2.293 2.294 6.543-6.544a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
