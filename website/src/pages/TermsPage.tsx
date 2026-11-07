import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'
import { LegalShell } from './PrivacyPage'

export function TermsPage() {
  return (
    <>
      <Seo
        title="Terms of Service"
        description="Terms for using the SlipUpClipz Windows app, Free and Pro plans, and the website."
        path={SITE.paths.terms}
      />
      <LegalShell
        title="Terms of Service"
        updated="Updated October 22, 2026. These terms describe the current product. They do not name a legal entity, a home state, or a court. A lawyer should add those and review this page before publication."
      >
        <p>
          These terms cover the SlipUpClipz Windows application and the website at {SITE.websiteUrl}.
          If you do not agree, do not download the app or buy Pro.
        </p>

        <h2>The license</h2>
        <p>
          SlipUpClipz gives you a personal, non-exclusive license to install and use the Windows
          app. Free includes the clipping and soundboard features described on the pricing page,
          including 7 pads. Pro is an annual subscription that adds the Pro features in effect at
          the time, including 50 pads and Pro Cut. AI Voice Clip Cloning is included with Pro on the
          Windows installer for v{SITE.currentVersion}. The current Microsoft Store release does not
          include AI Voice Cloning.
        </p>
        <p>
          You may not resell the installer, present it as your own product, or share a Pro license
          key so other people can activate Pro. The current software does not enforce a numbered
          device cap. The key is stored on the PC where you activate it and is checked with our
          license server.
        </p>

        <h2>Subscriptions and renewal</h2>
        <p>
          Website Pro is billed by Stripe as an annual subscription. The price advertised on this
          site is {SITE.pricing.proPriceLabel} per year. Stripe Checkout shows the exact charge
          before you pay, and that amount controls. The subscription renews each year at the regular
          price unless you cancel before the renewal. A first-year thank-you discount, when one is
          applied, reduces only the first invoice.
        </p>
        <p>
          The license email links to Manage subscription on the pricing page. The same control is
          in the app under Settings → License. You can also cancel from the pricing page without the
          app. It asks for the license key and the checkout email, or emails a one-time link if
          you only have the purchase email, then opens Stripe so you can update billing or cancel
          automatic renewal. Canceling stops the next charge. Pro remains available until the end
          of the period you already paid. A full refund of the current year ends Pro and cancels
          future renewal charges. Removing the license from a computer does not cancel billing.
          Email{' '}
          <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> if Pro ends sooner than
          you expect. Microsoft Store purchases, if you use them, follow Microsoft&apos;s billing
          terms instead of Stripe.
        </p>
        <p>
          See the <Link to={SITE.paths.refund}>Refund Policy</Link> for cancellation and refund
          requests. Nothing here limits a consumer right that cannot legally be waived.
        </p>

        <h2>Acceptable use</h2>
        <p>You are responsible for how you use SlipUpClipz. Do not use it to:</p>
        <ul>
          <li>break the law, or break Discord, game, or platform rules that apply to you</li>
          <li>harass, threaten, or defraud someone</li>
          <li>capture or replay audio you are not allowed to record or share</li>
          <li>
            create synthetic speech from a person&apos;s voice unless that speaker gave permission,
            or use a generated clip to impersonate someone or mislead others about who is speaking
          </li>
        </ul>
        <p>
          English is the language of AI Voice Clip Cloning we have tested well enough to describe. Voice
          similarity is not guaranteed. Generation needs a compatible NVIDIA GPU and uses that GPU
          while a clip is created. It does not run on every graphics card.
        </p>

        <h2>Platform and availability</h2>
        <p>
          The app is for Windows 10 and Windows 11. Features that depend on your audio devices,
          virtual cable, or GPU can vary by machine. We may change, add, or remove features. The
          public download stays on the latest published installer until a newer one is released.
        </p>

        <h2>Updates and accounts</h2>
        <p>
          Direct-download builds can check GitHub Releases for a newer version. Microsoft Store
          installs update through the Store. There is no separate SlipUpClipz account website. Pro
          access is the license key emailed after a website purchase, or the entitlement from the
          Store if you bought there.
        </p>

        <h2>The website</h2>
        <p>
          Product descriptions are meant to match the software. Screenshots of upcoming features are
          labeled when they are not in the current public download. Sample audio on the site is for
          demonstration.
        </p>

        <h2>Disclaimers</h2>
        <p>
          The app and website are provided as available. To the extent the law allows, SlipUpClipz
          disclaims implied warranties of merchantability, fitness for a particular purpose, and
          non-infringement. Some places do not allow those disclaimers, and in those places they
          apply only as far as the law permits. A lawyer should review this section before
          publication.
        </p>
        <p>
          To the extent the law allows, SlipUpClipz is not liable for indirect or consequential
          damages, or for lost profits, from using the app or the site. If a liability cap is
          allowed where you live, our total liability for a claim about the software or a website
          purchase is limited to the amount you paid us for Pro in the three months before the
          claim. This cap does not apply where the law forbids it, including liability that cannot
          be limited for death, personal injury, or fraud.
        </p>

        <h2>Contact</h2>
        <p>
          Questions: <Link to={SITE.paths.contact}>Contact Support</Link> or{' '}
          <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. The{' '}
          <Link to={SITE.paths.privacy}>Privacy Policy</Link> describes information the app and
          website handle.
        </p>
      </LegalShell>
    </>
  )
}
