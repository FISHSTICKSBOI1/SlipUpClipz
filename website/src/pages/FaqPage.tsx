import { FaqAccordion } from '../components/FaqAccordion'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'
import { FAQ_ITEMS } from '../data/faq'

export function FaqPage() {
  return (
    <>
      <Seo
        title="FAQ"
        description="Frequently asked questions about SlipUpClipz recording, Discord routing, Pro pricing, updates, and SmartScreen."
        path={SITE.paths.faq}
      />
      <section className="site-container py-14 sm:py-20">
        <SectionHeading
          eyebrow="FAQ"
          title="Common questions"
          description="Expand a card for a short answer. For deeper steps, visit the Help Center."
        />
        <div className="mx-auto mt-10 max-w-3xl">
          <FaqAccordion items={FAQ_ITEMS} />
        </div>
      </section>
    </>
  )
}
