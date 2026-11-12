import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'
import { LegalShell } from './PrivacyPage'

export function CookiesPage() {
  return (
    <>
      <Seo
        title="Cookie Policy"
        description="Cookies and similar storage used by the SlipUpClipz website, including YouTube and Stripe."
        path={SITE.paths.cookies}
      />
      <LegalShell
        title="Cookie Policy"
      >
        <p>
          This page lists the cookies and similar storage the SlipUpClipz website actually uses. The
          Windows app stores settings and clips on your PC. That local storage is described in the{' '}
          <Link to={SITE.paths.privacy}>Privacy Policy</Link>, and it is not a browser cookie.
        </p>

        <h2>Cookies we set</h2>
        <p>
          The website code does not set an analytics cookie, an advertising cookie, or a login
          cookie. There is no cookie banner, because the site does not drop optional tracking
          cookies when a page loads.
        </p>
        <p>
          After a successful survey submission, the server sends a header that expires a leftover
          cookie named <code>slipup_survey_claim</code> if your browser still has it. The current
          survey does not store a new value in that cookie. It is not used to decide whether you
          can check out.
        </p>

        <h2>Storage in the page</h2>
        <p>
          The survey, the support chat, and checkout buttons keep their state in memory while the
          page is open. Closing the survey or leaving the page clears that view. The site does not
          save the survey answers in your browser in order to lock the form.
        </p>

        <h2>Cookies other services may set</h2>
        <ul>
          <li>
            YouTube: the demo player loads only after you press play, on the youtube-nocookie.com
            domain. YouTube can set cookies once that player starts. YouTube&apos;s policy applies.
          </li>
          <li>
            Stripe: Buy Pro opens Stripe Checkout on Stripe&apos;s site. Stripe sets the cookies it
            needs to take payment and prevent fraud. Stripe&apos;s policy applies.
          </li>
          <li>
            The download link sends you to GitHub for the installer. GitHub may set cookies on its
            own site.
          </li>
        </ul>
        <p>
          We do not control those cookies. If you do not want them, do not press play on the demo,
          do not open Checkout, and do not follow the download redirect.
        </p>

        <h2>Consent</h2>
        <p>
          Embedded YouTube players load only after you press play. You can use the rest of the
          website without loading a player. Third-party sites you choose to open control their own
          cookies and privacy settings.
        </p>
      </LegalShell>
    </>
  )
}
