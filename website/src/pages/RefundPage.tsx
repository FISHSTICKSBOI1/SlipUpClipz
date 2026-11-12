import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'
import { LegalShell } from './PrivacyPage'

export function RefundPage() {
  return (
    <>
      <Seo
        title="Refund Policy"
        description="How to cancel SlipUpClipz Pro or ask for help with a website or Microsoft Store purchase."
        path={SITE.paths.refund}
      />
      <LegalShell
        title="Refund Policy"
      >
        <p>
          Website Pro and Microsoft Store purchases are different. Use the path that matches where
          you paid.
        </p>

        <h2>Website purchases through Stripe</h2>
        <p>
          Pro bought on this website is an annual Stripe subscription. The price advertised today is{' '}
          {SITE.pricing.proPriceLabel} per year, and Checkout shows the exact charge before you pay.
          The plan renews yearly at the regular price unless it is canceled. A first-year discount,
          if one was applied, covers only that first invoice.
        </p>
        <p>
          To stop the next renewal, open <Link to={`${SITE.paths.pricing}#manage`}>Manage subscription</Link>{' '}
          on the pricing page, or use Settings → License in the app. You do not need the app or the
          computer where Pro was activated. Enter the license key and the checkout email, or, if
          you lost the key, ask the pricing page to email a one-time link to the purchase address.
          Stripe opens the billing page, where you can cancel automatic renewal. Canceling stops
          future charges and Pro stays on through the period you already paid. A full refund of the
          current year ends Pro and also cancels future renewal charges. A partial refund, or a
          refund of an earlier year, does not cancel the current subscription. Removing the license
          from a computer does not cancel billing. If Pro turns off before that paid period ends,
          email{' '}
          <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> with the purchase email and
          approximate date.

        </p>
        <p>
          Refunds of a charge that already went through are reviewed one request at a time. We have
          not promised an automatic refund period, and this page does not promise that every request
          is approved. If the purchase never delivered a working license key, contact us and we will
          help fix the delivery or review a refund. Email the purchase address and about when you
          paid, or use the <Link to={SITE.paths.contact}>Contact</Link> page.
        </p>
        <p>
          This policy does not limit refund, cancellation, or cooling-off rights that a law says
          cannot be waived.
        </p>

        <h2>Microsoft Store purchases</h2>
        <p>
          If you paid Microsoft, refund and cancellation requests go through Microsoft&apos;s Store
          process. We cannot refund a Store charge from this website. The website first-year
          discount does not apply to Store purchases.
        </p>

        <h2>Disputes</h2>
        <p>
          Contact support before opening a payment dispute if you can. A disputed, refunded, or
          revoked license can be turned off by the license server. Sharing a key or abusing the
          checkout is not a reason we will restore Pro.
        </p>
      </LegalShell>
    </>
  )
}
