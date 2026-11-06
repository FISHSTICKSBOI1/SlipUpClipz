import { Link } from 'react-router-dom'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'
import type { ReactNode } from 'react'

const REVIEW =
  'Updated October 22, 2026. This describes how SlipUpClipz works today. It does not name a legal entity or mailing address, because those have not been provided. A lawyer should review it before publication.'

export function PrivacyPage() {
  return (
    <>
      <Seo
        title="Privacy Policy"
        description="How SlipUpClipz handles clips on your PC, website feedback, Stripe purchases, license checks, and support messages."
        path={SITE.paths.privacy}
      />
      <LegalShell title="Privacy Policy" updated={REVIEW}>
        <p>
          This policy covers the SlipUpClipz Windows app and the website at {SITE.websiteUrl}. It
          is written from the current product. It is not a claim that every privacy law has been
          formally satisfied.
        </p>

        <h2>What stays on your computer</h2>
        <p>
          Clips you capture or import, trim settings, soundboard pads, hotkeys, and app preferences
          are stored on your Windows PC. SlipUpClipz does not upload those recordings as part of
          normal clipping, playback, or AI Voice Clip Cloning.
        </p>
        <p>
          AI Voice Clip Cloning, when it is in a future Pro release, runs on your computer with a local
          model. The reference recording and the generated clip stay on that PC. The website does
          not receive your microphone audio. Sample voices played on this website are files we
          host for the product demonstration. They are not recordings from site visitors.
        </p>
        <p>
          The whole app does not work without an internet connection. License checks, downloads,
          update checks, and purchases need a network. An already validated Pro license can keep
          working offline for up to 24 hours after the last successful check. Opening the app
          again does not start those 24 hours over. After that, the app
          needs to reach the license server again.
        </p>

        <h2>License checks</h2>
        <p>
          When you activate Pro, the app sends the license key and a one-way device id to the
          SlipUpClipz license server at slipupclipz.com. The server returns whether that key is
          valid, whether this computer holds the single Pro seat, and when the current period ends.
          The key and that status are saved on your PC. While the PC is online, the app rechecks at
          launch and about every 15 minutes. One license works on one computer at a time. Installed
          copies from before that check keep working until SlipUpClipz ends that period, and only
          after an update is available through the Microsoft Store and the website. The device
          id is a hash of the Windows installation id, not a list of hardware parts.
        </p>

        <h2>Purchases</h2>
        <p>
          Website Pro purchases are processed by Stripe. Card details are entered on Stripe&apos;s
          checkout page, not on a SlipUpClipz form. Stripe&apos;s privacy policy applies to that
          payment data. We receive what we need to email your license key and to turn Pro on or off,
          including subscription status. The license email is sent through Resend to the address
          used at checkout.
        </p>
        <p>
          Microsoft Store purchases are handled by Microsoft. This website does not receive your
          Store payment details.
        </p>

        <h2>Survey feedback</h2>
        <p>
          The pricing-page survey asks how you heard about SlipUpClipz, where you downloaded it, and
          an optional note about what to improve. It does not ask for your name, email, or payment
          details. A hidden field is used to reject automated submissions.
        </p>
        <p>
          We store the answers, the time, and the first 8 characters of a salted hash of your
          network address. The hash is used to limit submissions to 5 per 24 hours from the same
          network. We do not publish the answers. They are kept in a private store on our website
          host, Netlify. We have not set a fixed deletion date. Email{' '}
          <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> to ask for deletion.
        </p>
        <p>
          A successful submission also tells the browser to expire an old cookie named{' '}
          <code>slipup_survey_claim</code> if one is still present. The current survey does not save
          a new tracking cookie, and it does not require a cookie to reveal the thank-you discount.
        </p>

        <h2>Support and the website assistant</h2>
        <p>
          The contact form asks for your name, email, subject, and message, and may include a
          category, app version, and Windows version if you provide them. The message is emailed to
          support through Resend. Do not include passwords, full license keys, payment card numbers,
          or private recordings.
        </p>
        <p>
          If you use the AI Support Assistant, the question you type and the recent messages in that
          open panel are sent to OpenAI to produce a reply. This version does not save that
          conversation on a SlipUpClipz server after the response is returned. The assistant is rate
          limited. Do not send secrets in a chat message.
        </p>

        <h2>Downloads, updates, and embedded video</h2>
        <p>
          The Windows download button redirects to the latest public installer on GitHub Releases.
          Packaged copies of the app can also contact GitHub to check for updates. GitHub&apos;s
          policies apply to those requests.
        </p>
        <p>
          The product demo on this site loads a YouTube video only after you press play, using
          YouTube&apos;s privacy-enhanced player domain. YouTube may set its own cookies at that
          point. See the <Link to={SITE.paths.cookies}>Cookie Policy</Link>.
        </p>

        <h2>Analytics and advertising</h2>
        <p>
          The website code does not include a third-party analytics or advertising script. If that
          changes, this policy will be updated first.
        </p>

        <h2>Children</h2>
        <p>
          SlipUpClipz is not directed at children under 13. Do not send a child&apos;s personal
          information through the survey or the contact form.
        </p>

        <h2>Requests</h2>
        <p>
          To ask what survey or support information we have, or to ask us to delete it, email{' '}
          <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> or use the{' '}
          <Link to={SITE.paths.contact}>Contact</Link> page. We may need enough detail to find the
          message. We do not control data that Stripe, Microsoft, GitHub, YouTube, OpenAI, or Resend
          hold under their own policies.
        </p>
        <p>
          A formal privacy program for California or other regions still needs a legal entity, a
          mailing address, and review by a qualified lawyer. This page describes the practices
          above. It does not state that SlipUpClipz meets a particular statute.
        </p>
        <p>
          Related pages: <Link to={SITE.paths.terms}>Terms</Link>,{' '}
          <Link to={SITE.paths.refund}>Refund Policy</Link>, and{' '}
          <Link to={SITE.paths.cookies}>Cookie Policy</Link>.
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
      <div className="prose-legal mt-10 max-w-3xl space-y-5 text-sm leading-relaxed text-slate-300 [&_a]:text-glow-magenta [&_a]:hover:underline [&_code]:text-slate-200 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}
