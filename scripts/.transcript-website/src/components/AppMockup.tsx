export function AppMockup({ className = '' }: { className?: string }) {
  return (
    <div
      className={`shot-frame shot-float ${className}`}
      role="img"
      aria-label="SlipUpClipz app window showing replay buffer, waveform trimmer, soundboard pads, and voice effects"
    >
      <div className="flex items-center gap-2 border-b border-ink-border/80 bg-ink/80 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" aria-hidden />
        <p className="ml-2 text-xs font-medium text-slate-400">SlipUpClipz</p>
        <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-emerald-400" />
          Buffer live
        </span>
      </div>

      <div className="grid gap-3 bg-gradient-to-b from-ink-raised to-ink p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-ink-border/80 bg-ink/60 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Replay buffer</span>
              <span>Last 12s</span>
            </div>
            <div className="flex h-14 items-end gap-[3px]">
              {Array.from({ length: 36 }).map((_, i) => {
                const h = 18 + ((i * 19) % 70)
                return (
                  <span
                    key={i}
                    className="w-full rounded-sm bg-glow-blue/50"
                    style={{ height: `${h}%` }}
                  />
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-ink-border/80 bg-ink/60 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Trim editor</span>
              <span>0:04 – 0:09</span>
            </div>
            <div className="flex h-14 items-end gap-[3px]">
              {Array.from({ length: 28 }).map((_, i) => {
                const h = 22 + ((i * 23) % 65)
                const active = i >= 8 && i <= 20
                return (
                  <span
                    key={i}
                    className={`w-full rounded-sm ${
                      active
                        ? 'bg-gradient-to-t from-glow-purple to-glow-magenta'
                        : 'bg-slate-700/70'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                )
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-ink-border/80 bg-ink/60 p-3">
          <div className="mb-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>Soundboard</span>
            <span>Stop All</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {['LOL', 'No way', 'Clip', 'Bruh', 'GG', 'Wait', 'What', 'Send it'].map(
              (label, i) => (
                <div
                  key={label}
                  className={`rounded-lg border px-1.5 py-3 text-center text-[10px] font-semibold sm:text-[11px] ${
                    i === 2
                      ? 'border-glow-purple/70 bg-glow-purple/25 text-white'
                      : 'border-ink-border bg-ink-panel text-slate-300'
                  }`}
                >
                  {label}
                </div>
              ),
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-border/80 bg-ink/60 px-3 py-2.5">
          <span className="text-[11px] text-slate-400">Voice effects</span>
          {['Deep', 'Squeaky', 'Radio', 'Robot'].map((preset, i) => (
            <span
              key={preset}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                i === 1
                  ? 'bg-glow-magenta/25 text-glow-magenta'
                  : 'bg-ink-panel text-slate-300'
              }`}
            >
              {preset}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
