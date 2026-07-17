export function ScreenshotPlaceholder({
  label,
  aspect = 'video',
  className = '',
}: {
  label: string
  aspect?: 'video' | 'wide' | 'square'
  className?: string
}) {
  const aspectClass =
    aspect === 'wide' ? 'aspect-[16/7]' : aspect === 'square' ? 'aspect-square' : 'aspect-video'

  return (
    <figure
      className={`overflow-hidden rounded-2xl border border-dashed border-ink-border bg-ink-panel/60 ${aspectClass} ${className}`}
    >
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="rounded-full border border-ink-border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Screenshot placeholder
        </span>
        <figcaption className="text-sm text-slate-400">{label}</figcaption>
      </div>
    </figure>
  )
}
