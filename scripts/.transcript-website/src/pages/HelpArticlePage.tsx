import { Link, Navigate, useParams } from 'react-router-dom'
import { ScreenshotFrame } from '../components/ScreenshotFrame'
import { Seo } from '../components/Seo'
import { StillNeedHelp } from '../components/StillNeedHelp'
import { SITE } from '../config/site'
import {
  getArticleBySlug,
  HELP_CATEGORIES,
  type HelpCategoryId,
} from '../data/helpArticles'

type ShotKey = keyof typeof SITE.screenshots

const CATEGORY_SHOT: Record<HelpCategoryId, ShotKey> = {
  'getting-started': 'onboarding',
  clipping: 'clips',
  soundboard: 'soundboard',
  discord: 'settings',
  'voice-effects': 'voiceEffects',
  updates: 'settings',
}

const SLUG_SHOT: Record<string, ShotKey> = {
  'first-time-guided-tour': 'onboarding',
  'choosing-replay-audio-source': 'clips',
  'setting-the-clip-hotkey': 'clips',
  'clip-button-does-nothing': 'clips',
  'clip-has-no-audio': 'trim',
  'could-not-decode-clip': 'trim',
  'soundboard-cannot-be-heard': 'soundboard',
  'hotkey-does-not-work': 'soundboard',
  'imported-mp3-wav-will-not-play': 'soundboard',
  'stop-all-sounds': 'soundboard',
  'adjusting-pad-volume': 'soundboard',
  'enabling-voice-effects': 'voiceEffects',
  'adjusting-pitch-and-bass': 'voiceEffects',
  'using-voice-presets': 'voiceEffects',
  'reducing-delay-or-distortion': 'voiceEffects',
  'checking-for-updates': 'settings',
  'restarting-to-install': 'settings',
  'activating-pro': 'settings',
}

export function HelpArticlePage() {
  const { slug = '' } = useParams()
  const article = getArticleBySlug(slug)

  if (!article) {
    return <Navigate to={SITE.paths.help} replace />
  }

  const category = HELP_CATEGORIES.find((c) => c.id === article.category)
  const shot = SLUG_SHOT[article.slug] ?? CATEGORY_SHOT[article.category]

  return (
    <>
      <Seo
        title={article.title}
        description={article.summary}
        path={`${SITE.paths.help}/${article.slug}`}
      />
      <article className="site-container py-14 sm:py-20">
        <nav className="text-sm text-slate-500">
          <Link to={SITE.paths.help} className="hover:text-white">
            Help Center
          </Link>
          <span className="mx-2">/</span>
          <span>{category?.title ?? 'Article'}</span>
        </nav>

        <header className="mt-6 max-w-3xl">
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
            {article.title}
          </h1>
          <p className="mt-4 text-base text-slate-400">{article.summary}</p>
        </header>

        <div className="mt-8 max-w-3xl">
          <ScreenshotFrame shot={shot} alt={`SlipUpClipz — ${article.screenshotLabel}`} />
        </div>

        <ol className="mt-10 max-w-3xl list-decimal space-y-4 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          {article.steps.map((step) => (
            <li key={step} className="pl-2">
              {step}
            </li>
          ))}
        </ol>

        {article.tips?.length ? (
          <div className="mt-8 max-w-3xl rounded-xl border border-ink-border bg-ink-raised/70 p-5">
            <h2 className="font-display text-lg font-semibold text-white">Tips</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              {article.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="max-w-3xl">
          <StillNeedHelp />
        </div>
      </article>
    </>
  )
}
