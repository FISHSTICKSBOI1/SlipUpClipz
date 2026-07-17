import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { Button } from '../components/Button'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'

export function NotFoundPage() {
  return (
    <>
      <Seo
        title="Page not found"
        description="The page you are looking for does not exist or may have moved."
        path="/404"
      />
      <section className="site-container flex flex-col items-center py-24 text-center sm:py-32">
        <BrandMark />
        <p className="mt-10 text-sm font-semibold uppercase tracking-[0.2em] text-glow-magenta">
          404
        </p>
        <h1 className="mt-4 max-w-lg font-display text-3xl font-bold text-white sm:text-4xl">
          Looks like this clip got lost.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-slate-400">
          The page you are looking for does not exist or may have moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to={SITE.paths.home} className="btn-lift">
            Back to Home
          </Button>
          <Button to={SITE.paths.help} variant="secondary" className="btn-lift">
            Open Help Center
          </Button>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Or <Link to={SITE.paths.contact}>contact support</Link>.
        </p>
      </section>
    </>
  )
}
