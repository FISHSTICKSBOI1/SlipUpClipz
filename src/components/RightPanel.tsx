import { useLocation } from 'react-router-dom'
import { useClipLibraryContext } from '../context/ClipLibraryContext'
import { formatRelativeDate } from '../lib/format'
import { InformationCircleIcon } from './icons'

const panelContent: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Overview',
    description:
      'Your workspace dashboard. Recent activity and clip summaries appear here.',
  },
  '/clips': {
    title: 'Clip library',
    description:
      'Record microphone audio, save clips, and play them back from your library.',
  },
  '/soundboard': {
    title: 'Soundboard',
    description:
      'Fill pad slots manually, play clips instantly, and trigger them with global hotkeys.',
  },
  '/settings': {
    title: 'Preferences',
    description:
      'Configure appearance, window behavior, and app defaults from the settings panel.',
  },
}

export function RightPanel() {
  const { pathname } = useLocation()
  const { clips } = useClipLibraryContext()
  const content = panelContent[pathname] ?? panelContent['/']

  const newestClip = [...clips].sort((a, b) => b.createdAt - a.createdAt)[0]
  const hotkeyCount = clips.filter((c) => c.hotkey).length

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-white/5 bg-[#0a0c14]/95 2xl:w-80">
      <div className="border-b border-white/5 px-5 py-4">
        <p className="control-label">Details</p>
        <h2 className="mt-1 section-title">Workspace</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="panel p-4">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
            <InformationCircleIcon className="h-5 w-5 text-accent-hover" />
          </div>
          <h3 className="text-sm font-semibold text-white">{content.title}</h3>
          <p className="mt-2 helper-text">{content.description}</p>
        </div>

        <div className="mt-4 space-y-3">
          <StatCard label="Total clips" value={String(clips.length)} />
          <StatCard label="Hotkeys assigned" value={String(hotkeyCount)} />
          <StatCard
            label="Latest clip"
            value={newestClip ? newestClip.name : '—'}
          />
          <StatCard
            label="Last updated"
            value={newestClip ? formatRelativeDate(newestClip.createdAt) : 'Never'}
          />
        </div>
      </div>
    </aside>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-chip flex items-center justify-between gap-3">
      <span className="control-label">{label}</span>
      <span className="truncate text-sm font-semibold text-white">{value}</span>
    </div>
  )
}
