import { useSearchParams } from 'react-router-dom'
import { ComparisonTable } from '../components/ComparisonTable'
import { PricingCards } from '../components/PricingCards'
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
        description="Download SlipUpClipz Free or upgrade to Pro for $4.99/year."
        path={SITE.paths.pricing}
      />
      <section className="section-space">
        <div className="site-container">
          <SectionHeading
            align="center"
            eyebrow="Pricing"
            title="Start free. Upgrade to Pro."
            description="Free to start. Pro is $4.99/year with secure Stripe checkout."
          />

          {purchaseStatus === 'success' ? (
            <div
              className="mx-auto mt-8 max-w-2xl rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-100"
              role="status"
            >
              Payment received. Check your email for your SlipUpClipz Pro license key.
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
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
            Windows only. See the{' '}
            <a href={SITE.paths.refund} className="text-glow-magenta hover:underline">
              Refund Policy
            </a>{' '}
            for purchase details. Promotion codes can be entered on the Stripe Checkout page.
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
