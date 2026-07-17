import { Link } from 'react-router-dom'
import { BottomCta } from '../components/BottomCta'
import { Button } from '../components/Button'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'
import { CHANGELOG } from '../data/changelog'

export function ChangelogPage() {
  return (
    <>
      <Seo
        title="Changelog — SlipUpClipz"
        description="Release notes for SlipUpClipz on Windows, including updates, voice effects, and soundboard improvements."
        path={SITE.paths.changelog}
      />

      <section className="section-space">
        <div className="site-container">
          <SectionHeading
            eyebrow="Changelog"
            title="What’s new in SlipUpClipz"
            description="Release notes for the Windows app. Newest versions appear first."
          />

          <div className="relative mx-auto mt-12 max-w-3xl">
            <div
              className="absolute bottom-2 left-[1.15rem] top-2 w-px bg-ink-border sm:left-[1.4rem]"
              aria-hidden
            />
            <ol className="space-y-8">
              {CHANGELOG.map((entry) => (
                <li key={entry.version} className="relative pl-12 sm:pl-14">
                  <span
                    className="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border border-glow-purple/40 bg-ink-panel text-[11px] font-bold text-glow-magenta sm:h-10 sm:w-10"
                    aria-hidden
                  >
                    v
                  </span>
                  <article className="panel p-5 sm:p-6">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="font-display text-xl font-bold text-white">
                        {entry.version}
                      </h2>
                      <time
                        dateTime={entry.date}
                        className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500"
                      >
                        {formatDate(entry.date)}
                      </time>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-300">{entry.title}</p>
                    <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-400">
                      {entry.highlights.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-glow-purple" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Button href={SITE.downloadUrl} className="btn-lift">
              Download for Windows
            </Button>
            <Button href={SITE.releasesUrl} variant="secondary" className="btn-lift">
              View GitHub Releases
            </Button>
            <Link
              to={SITE.paths.help}
              className="inline-flex items-center text-sm font-semibold text-slate-400 hover:text-white"
            >
              Help Center
            </Link>
          </div>
        </div>
      </section>

      <BottomCta />
    </>
  )
}

function formatDate(iso: string) {
  const date = new Date(`${iso}T12:00:00`)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
