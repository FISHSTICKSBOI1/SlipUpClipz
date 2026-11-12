export function MotionToggle({ paused, name, onToggle }: {
  paused: boolean
  name: 'animation' | 'slideshow'
  onToggle: () => void
}) {
  const label = `${paused ? 'Play' : 'Pause'} ${name}`
  return (
    <button
      type="button"
      className="motion-toggle inline-grid h-8 w-8 shrink-0 place-items-center rounded-md border border-ink-border/80 text-slate-300 hover:bg-ink/70 hover:text-white"
      onClick={onToggle}
      aria-label={label}
      title={label}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
        <path d={paused ? 'M4 2.5v11l9-5.5Z' : 'M4 3h2.5v10H4zm5.5 0H12v10H9.5z'} />
      </svg>
    </button>
  )
}
