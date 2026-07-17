import { Link } from 'react-router-dom'
import { SITE } from '../config/site'

export function AiSupportPlaceholder() {
  return (
    <section className="panel relative overflow-hidden p-6 sm:p-8">
      <div className="absolute inset-0 bg-gradient-to-r from-glow-purple/10 via-transparent to-glow-magenta/10" />
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-ink/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-glow-cyan">
          Coming soon
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold text-white">AI Support Assistant</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          A guided assistant will help troubleshoot audio devices, Discord routing, clipping,
          trimming, and soundboard playback. It is not live yet — use Help Center articles or
          Contact Support for answers today.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Need help now? Visit the{' '}
          <Link to={SITE.paths.help} className="text-glow-magenta underline-offset-2 hover:underline">
            Help Center
          </Link>{' '}
          or{' '}
          <Link
            to={SITE.paths.contact}
            className="text-glow-magenta underline-offset-2 hover:underline"
          >
            Contact Support
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
