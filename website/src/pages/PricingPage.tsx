import { useSearchParams } from 'react-router-dom'
import { ComparisonTable } from '../components/ComparisonTable'
import { ManageSubscription } from '../components/ManageSubscription'
import { PlanComparison } from '../components/PlanComparison'
import { PricingCards } from '../components/PricingCards'
import { SurveyOffer } from '../components/SurveyOffer'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { BottomCta } from '../components/BottomCta'
import { SITE } from '../config/site'

export function PricingPage() {
  const [searchParams] = useSearchParams()
  const purchaseStatus = searchParams.get('purchase')



  return (
    <>
      <Seo
        title="Pricing"
        description="Download SlipUpClipz Free, or upgrade to Pro. Pro is an annual subscription advertised at $4.99/year. See the survey’s advertised first-year offer and manage your existing subscription."
        path={SITE.paths.pricing}
      />
      <section className="section-space">
        <div className="site-container">
          <SectionHeading as="h1"
            align="center"
            eyebrow="Pricing"
            title="Start free. Upgrade to Pro."
            description="Free includes the soundboard. Pro is an annual Stripe subscription, advertised at $4.99/year."
          />

          {purchaseStatus === 'success' ? (
            <div
              className="mx-auto mt-8 max-w-2xl rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-100"
              role="status"
            >
              Checkout complete. Once payment is confirmed, your Pro license key will arrive by email.
            </div>
          ) : null}

          {purchaseStatus === 'canceled' ? (
            <div
              className="mx-auto mt-8 max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100"
              role="status"
            >
              Checkout was canceled. You can try again whenever you are ready.
            </div>
          ) : null}

          <div className="mx-auto mt-12 max-w-4xl">
            <PricingCards />
          </div>
          <div className="mx-auto mt-8 max-w-4xl">
            <SurveyOffer />
          </div>
          <div className="mx-auto mt-16 max-w-4xl">
            <SectionHeading
              align="center"
              eyebrow="Plans"
              title="Free versus Pro"
              description="Hotkeys, cable routing, voice effects, and startup are included free. Pro adds pads and AI Voice Clip Cloning."
            />
            <div className="mt-10">
              <PlanComparison />
            </div>
          </div>
          <div className="mx-auto mt-16 max-w-4xl">
            <ManageSubscription />
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-slate-500">
            SlipUpClipz is available through the Microsoft Store and as a direct Windows download.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-500">
            Windows only. See the{' '}
            <a href={SITE.paths.refund} className="text-glow-magenta hover:underline">
              Refund Policy
            </a>{' '}
            for purchase details. The advertised survey offer is $1 off the first year of a new website
            subscription, and it cannot be applied twice on the same checkout. Pro licenses are
            purchased through Stripe on this site, not through Microsoft Store.
          </p>

          <div className="mx-auto mt-16 max-w-4xl">
            <SectionHeading
              align="center"
              eyebrow="Compare"
              title="Why SlipUpClipz is different"
              description="Traditional soundboards play files. SlipUpClipz also captures the moment that just happened."
            />
            <div className="mt-10">
              <ComparisonTable />
            </div>
          </div>
        </div>
      </section>
      <BottomCta />
    </>
  )
}
