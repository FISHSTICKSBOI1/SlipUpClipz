import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'
import { LegalShell } from './PrivacyPage'

export function RefundPage() {
  return (
    <>
      <Seo
        title="Refund Policy"
        description="Refund policy for SlipUpClipz Pro purchases."
        path={SITE.paths.refund}
      />
      <LegalShell title="Refund Policy" updated="Draft — pending legal review">
        <p>
          Pro is intended as a one-time lifetime purchase. Online checkout is not connected on this
          website yet, so refund rules below describe the planned approach and may be updated.
        </p>
        <h2>Planned approach</h2>
        <ul>
          <li>If a purchase fails to deliver a working license key, contact support for help.</li>
          <li>
            Refund eligibility windows and exceptions will be defined once the payment provider is
            live and this policy has been legally reviewed.
          </li>
          <li>Abuse, chargebacks without contact, or key sharing may void refund eligibility.</li>
        </ul>
        <h2>How to request help</h2>
        <p>
          Email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> with your purchase
          email and approximate order date, or use the <Link to={SITE.paths.contact}>Contact</Link>{' '}
          page.
        </p>
      </LegalShell>
    </>
  )
}
