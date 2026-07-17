import { Link } from 'react-router-dom'
import { Button } from './Button'
import { SITE } from '../config/site'

export function StillNeedHelp() {
  return (
    <aside className="mt-10 rounded-2xl border border-ink-border bg-ink-raised/70 p-6">
      <h2 className="font-display text-xl font-bold text-white">Still need help?</h2>
      <p className="mt-2 text-sm text-slate-400">
        If these steps did not fix it, reach out with your app version and a short description of
        what you tried.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button to={SITE.paths.contact}>Contact Support</Button>
        <Button to={SITE.paths.help} variant="secondary">
          Back to Help Center
        </Button>
        <Link
          to={SITE.paths.faq}
          className="inline-flex items-center text-sm font-medium text-slate-300 hover:text-white"
        >
          Browse FAQ
        </Link>
      </div>
    </aside>
  )
}
