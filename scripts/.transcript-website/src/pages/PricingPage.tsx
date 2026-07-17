import { ComparisonTable } from '../components/ComparisonTable'
import { PricingCards } from '../components/PricingCards'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { BottomCta } from '../components/BottomCta'
import { SITE } from '../config/site'

export function PricingPage() {
  return (
    <>
      <Seo
        title="Pricing"
        description="Download SlipUpClipz Free or unlock Pro for a one-time $4.99 lifetime purchase."
        path={SITE.paths.pricing}
      />
      <section className="section-space">
        <div className="site-container">
          <SectionHeading
            align="center"
            eyebrow="Pricing"
            title="Start free. Unlock Pro once."
            description="Free to start. Pro is a one-time payment — no subscription."
          />
          <div className="mx-auto mt-12 max-w-4xl">
            <PricingCards />
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
            Windows only. See the{' '}
            <a href={SITE.paths.refund} className="text-glow-magenta hover:underline">
              Refund Policy
            </a>{' '}
            for purchase details. Checkout goes live when payments are connected.
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
