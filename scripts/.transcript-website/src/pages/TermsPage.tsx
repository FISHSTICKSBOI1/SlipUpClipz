import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'
import { LegalShell } from './PrivacyPage'

export function TermsPage() {
  return (
    <>
      <Seo
        title="Terms of Service"
        description="Draft terms of service for using SlipUpClipz software and website."
        path={SITE.paths.terms}
      />
      <LegalShell title="Terms of Service" updated="Draft — pending legal review">
        <p>
          These draft terms describe intended use of SlipUpClipz. Replace with counsel-reviewed
          terms before relying on them.
        </p>
        <h2>License to use</h2>
        <p>
          SlipUpClipz grants you a personal license to install and use the Windows application
          according to Free or Pro entitlements. You may not redistribute the installer as your own
          product.
        </p>
        <h2>Acceptable use</h2>
        <p>
          Do not use SlipUpClipz to harass others, violate platform rules (including Discord or game
          policies), or break applicable law. You are responsible for how you use clipped audio.
        </p>
        <h2>No warranties (draft)</h2>
        <p>
          The software is provided as-is while in early release. Features may change. Full warranty
          and liability language will be finalized after legal review.
        </p>
        <h2>Updates</h2>
        <p>
          The app may offer automatic updates via GitHub Releases. Installing updates may be
          required for security or compatibility.
        </p>
        <h2>Contact</h2>
        <p>
          Questions: <Link to={SITE.paths.contact}>Contact Support</Link>.
        </p>
      </LegalShell>
    </>
  )
}
