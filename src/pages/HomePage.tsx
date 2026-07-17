import { Link } from 'react-router-dom'
import { useClipLibraryContext } from '../context/ClipLibraryContext'
import { formatRelativeDate } from '../lib/format'
import { PlusIcon } from '../components/icons'

export function HomePage() {
  const { clips, addClip } = useClipLibraryContext()

  const recentClips = [...clips]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5)

  function handleNewClip() {
    const name = window.prompt('Clip name')
    if (name) addClip(name)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section>
        <h1 className="page-title">Welcome back</h1>
        <p className="page-desc">
          SlipUpClipz is your desktop clip workspace. Clip from the replay buffer, play them back,
          and organize your library.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Clips"
          value={String(clips.length)}
          hint={clips.length === 0 ? 'No clips yet' : 'In your library'}
        />
        <MetricCard
          label="Hotkeys"
          value={String(clips.filter((c) => c.hotkey).length)}
          hint="Assigned shortcuts"
        />
        <MetricCard label="Status" value="Ready" hint="All systems go" />
      </section>

      <section className="panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Recent clips</h2>
            <p className="mt-1 text-xs text-gray-500">
              Newest clips from your library
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewClip}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <PlusIcon className="h-4 w-4" />
            New clip
          </button>
        </div>

        {recentClips.length === 0 ? (
          <p className="mt-5 text-sm text-gray-500">No clips in your library yet.</p>
        ) : (
          <ul className="mt-5 divide-y divide-surface-border">
            {recentClips.map((clip) => (
              <li
                key={clip.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <Link
                  to="/clips"
                  className="text-sm text-gray-300 transition-colors hover:text-white"
                >
                  {clip.name}
                </Link>
                <span className="text-xs text-gray-500">
                  {formatRelativeDate(clip.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="panel p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  )
}
