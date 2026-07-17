const ROWS = [
  { feature: 'Capture recent voice-chat audio', slipup: true, traditional: false },
  { feature: 'Replay buffer', slipup: true, traditional: false },
  { feature: 'Built-in trimming', slipup: true, traditional: false },
  { feature: 'Add captured moments directly to pads', slipup: true, traditional: false },
  { feature: 'Import MP3 and WAV', slipup: true, traditional: true },
  { feature: 'Global hotkeys', slipup: true, traditional: true },
  { feature: 'Virtual audio routing', slipup: true, traditional: 'sometimes' },
  { feature: 'Voice effects', slipup: true, traditional: 'sometimes' },
] as const

function Cell({ value }: { value: true | false | 'sometimes' }) {
  if (value === true) {
    return <span className="font-semibold text-emerald-300">Yes</span>
  }
  if (value === 'sometimes') {
    return <span className="text-slate-400">Sometimes</span>
  }
  return <span className="text-slate-500">No</span>
}

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-border">
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="sr-only">
          Comparison of SlipUpClipz and traditional soundboards
        </caption>
        <thead className="bg-ink-raised">
          <tr>
            <th scope="col" className="px-4 py-4 font-semibold text-slate-300 sm:px-6">
              Capability
            </th>
            <th scope="col" className="px-4 py-4 font-semibold text-white sm:px-6">
              SlipUpClipz
            </th>
            <th scope="col" className="px-4 py-4 font-semibold text-slate-300 sm:px-6">
              Traditional soundboards
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, index) => (
            <tr
              key={row.feature}
              className={index % 2 === 0 ? 'bg-ink-panel/40' : 'bg-ink/30'}
            >
              <th scope="row" className="px-4 py-3.5 font-medium text-slate-200 sm:px-6">
                {row.feature}
              </th>
              <td className="px-4 py-3.5 sm:px-6">
                <Cell value={row.slipup} />
              </td>
              <td className="px-4 py-3.5 sm:px-6">
                <Cell value={row.traditional} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
