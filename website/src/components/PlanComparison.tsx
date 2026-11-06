const ROWS = [
  { feature: 'Instant replay clipping', free: 'Yes', pro: 'Yes' },
  { feature: 'Recording, trimming, and clip library', free: 'Yes', pro: 'Yes' },
  { feature: 'Soundboard pads', free: '7', pro: '50' },
  { feature: 'Global hotkeys', free: 'Yes', pro: 'Yes' },
  { feature: 'VB-Audio Virtual Cable routing', free: 'Yes', pro: 'Yes' },
  { feature: 'Start with Windows', free: 'Yes', pro: 'Yes' },
  { feature: 'Voice effects', free: 'Yes', pro: 'Yes' },
  { feature: 'Hear Myself', free: 'Yes', pro: 'Yes' },
  { feature: 'Minimize to tray', free: 'Yes', pro: 'Yes' },
  { feature: 'AI Voice Clip Cloning', free: 'No', pro: 'Yes' },
] as const

export function PlanComparison() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-border">
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="sr-only">Free and Pro plan comparison</caption>
        <thead className="bg-ink-raised">
          <tr>
            <th scope="col" className="px-4 py-4 font-semibold text-slate-300 sm:px-6">
              Feature
            </th>
            <th scope="col" className="px-4 py-4 font-semibold text-white sm:px-6">
              Free
            </th>
            <th scope="col" className="px-4 py-4 font-semibold text-glow-magenta sm:px-6">
              Pro
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, index) => (
            <tr key={row.feature} className={index % 2 === 0 ? 'bg-ink-panel/40' : 'bg-ink/30'}>
              <th scope="row" className="px-4 py-3.5 font-medium text-slate-200 sm:px-6">
                {row.feature}
              </th>
              <td className="px-4 py-3.5 text-slate-300 sm:px-6">{row.free}</td>
              <td className="px-4 py-3.5 font-medium text-slate-100 sm:px-6">{row.pro}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
