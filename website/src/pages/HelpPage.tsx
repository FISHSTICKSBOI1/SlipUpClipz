import { Link } from 'react-router-dom'
import { AiSupportAssistant } from '../components/AiSupportAssistant'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'
import { HELP_ARTICLES, HELP_CATEGORIES } from '../data/helpArticles'

export function HelpPage() {
  return (
    <>
      <Seo
        title="Help Center"
        description="Install guides, clipping fixes, Discord routing, voice effects, updates, and licensing help for SlipUpClipz."
        path={SITE.paths.help}
      />
      <section className="site-container py-14 sm:py-20">
        <SectionHeading
          eyebrow="Help Center"
          title="Find answers fast"
          description="Browse by category or jump into a specific article. Every guide uses simple numbered steps."
        />

        <p className="mt-6 text-sm text-slate-400">
          Looking for release notes?{' '}
          <Link
            to={SITE.paths.changelog}
            className="font-semibold text-glow-magenta underline-offset-2 hover:underline"
          >
            View the Changelog
          </Link>
          .
        </p>

        <div className="mt-10">
          <AiSupportAssistant />
        </div>

        <div className="mt-12 space-y-10">
          {HELP_CATEGORIES.map((category) => {
            const articles = HELP_ARTICLES.filter((a) => a.category === category.id)
            return (
              <section key={category.id} aria-labelledby={`cat-${category.id}`}>
                <h2
                  id={`cat-${category.id}`}
                  className="font-display text-2xl font-bold text-white"
                >
                  {category.title}
                </h2>
                <p className="mt-2 text-sm text-slate-400">{category.description}</p>
                <ul className="mt-5 grid gap-3 md:grid-cols-2">
                  {articles.map((article) => (
                    <li key={article.slug}>
                      <Link
                        to={`${SITE.paths.help}/${article.slug}`}
                        className="block rounded-xl border border-ink-border bg-ink-panel/60 px-4 py-4 transition hover:border-glow-purple/50 hover:bg-ink-panel"
                      >
                        <span className="font-semibold text-white">{article.title}</span>
                        <span className="mt-1 block text-sm text-slate-400">
                          {article.summary}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </section>
    </>
  )
}
