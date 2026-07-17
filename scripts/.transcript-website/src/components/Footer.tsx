import { Link } from 'react-router-dom'
import { BrandMark } from './BrandMark'
import { Button } from './Button'
import { SITE } from '../config/site'

const PRODUCT = [
  { to: SITE.paths.features, label: 'Features' },
  { to: SITE.paths.pricing, label: 'Pricing' },
  { to: SITE.paths.download, label: 'Download' },
  { to: SITE.paths.changelog, label: 'Changelog' },
] as const

const SUPPORT = [
  { to: SITE.paths.help, label: 'Help Center' },
  { to: SITE.paths.faq, label: 'FAQ' },
  { to: SITE.paths.contact, label: 'Contact Support' },
] as const

const LEGAL = [
  { to: SITE.paths.privacy, label: 'Privacy Policy' },
  { to: SITE.paths.terms, label: 'Terms' },
  { to: SITE.paths.refund, label: 'Refund Policy' },
] as const

export function Footer() {
  const year = new Date().getFullYear()
  const socialEntries = [
    { label: 'Discord', href: SITE.social.discord },
    { label: 'TikTok', href: SITE.social.tiktok },
    { label: 'YouTube', href: SITE.social.youtube },
  ].filter((item) => Boolean(item.href))

  return (
    <footer className="mt-auto border-t border-ink-border bg-ink-raised/70">
      <div className="site-container grid gap-10 py-14 md:grid-cols-[1.2fr_repeat(3,0.8fr)] lg:grid-cols-[1.3fr_repeat(4,0.7fr)]">
        <div>
          <BrandMark />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            Capture recent voice-chat audio, trim the best part, and replay it through your
            soundboard on Windows.
          </p>
          <Button href={SITE.downloadUrl} className="btn-lift mt-5 !px-4 !py-2.5 !text-xs">
            Download for Windows
          </Button>
          <p className="mt-5 text-xs text-slate-500">
            Version {SITE.currentVersion} · Windows 10/11
          </p>
        </div>

        <FooterCol title="Product" links={PRODUCT} />
        <FooterCol title="Support" links={SUPPORT} />
        <FooterCol title="Legal" links={LEGAL} />

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Community
          </p>
          {socialEntries.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {socialEntries.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-sm text-slate-300 transition hover:text-white"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="border-t border-ink-border/70">
        <div className="site-container flex flex-col gap-2 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} SlipUpClipz. All rights reserved.</p>
          <p>Available for Windows</p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({
  title,
  links,
}: {
  title: string
  links: readonly { to: string; label: string }[]
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="text-sm text-slate-300 transition hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
