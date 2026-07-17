import { Link } from 'react-router-dom'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'
import type { ReactNode } from 'react'

export function PrivacyPage() {
  return (
    <>
      <Seo
        title="Privacy Policy"
        description="Draft privacy policy for SlipUpClipz covering local clips, settings, update checks, and support messages."
        path={SITE.paths.privacy}
      />
      <LegalShell title="Privacy Policy" updated="Draft — pending legal review">
        <p>
          This draft describes how the current SlipUpClipz desktop app and website are intended to
          handle information. It is not final legal advice and must be reviewed before public
          launch.
        </p>
        <h2>Audio clips and local storage</h2>
        <p>
          Audio clips you capture or import are stored locally on your computer. SlipUpClipz does
          not upload recordings by default.
        </p>
        <h2>Settings and device information</h2>
        <p>
          The app may store local settings such as hotkeys, UI preferences, selected device names,
          and license state on your machine so the product can work between sessions.
        </p>
        <h2>Update checks</h2>
        <p>
          Packaged builds may contact GitHub Releases to check for newer versions, download update
          metadata, and fetch installer files you choose to install.
        </p>
        <h2>Purchases and licensing</h2>
        <p>
          If you buy Pro later, payment or license providers may process purchase and entitlement
          information. Those providers’ policies will apply to payment data. Placeholder purchase
          links on this website are not live checkout yet.
        </p>
        <h2>Support messages</h2>
        <p>
          If you contact support through the website form, your submission is processed by Netlify
          and used only to respond to your request. We may receive the information you choose to
          submit (such as email, problem description, app version, and Windows version). Do not
          submit passwords, payment information, private recordings, or complete license keys.
        </p>
        <h2>AI Support Assistant</h2>
        <p>
          If you use the website AI Support Assistant, your messages are sent to the configured AI
          provider to generate a response. Messages are used only to answer your support question.
          Do not submit sensitive information. SlipUpClipz does not intentionally store AI chat
          conversations in this version.
        </p>
        <h2>Website analytics</h2>
        <p>
          This marketing site currently does not include third-party tracking scripts. If analytics
          are added later, this policy should be updated.
        </p>
        <h2>Contact</h2>
        <p>
          Privacy questions: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> or the{' '}
          <Link to={SITE.paths.contact}>Contact</Link> page.
        </p>
      </LegalShell>
    </>
  )
}

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <section className="site-container py-14 sm:py-20">
      <SectionHeading eyebrow="Legal" title={title} description={updated} />
      <div className="prose-legal mt-10 max-w-3xl space-y-5 text-sm leading-relaxed text-slate-300 [&_a]:text-glow-magenta [&_a]:hover:underline [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}
