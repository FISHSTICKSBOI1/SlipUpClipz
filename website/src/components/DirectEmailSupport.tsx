import { useState } from 'react'
import { SITE } from '../config/site'
import { copyTextToClipboard, getGmailComposeUrl } from '../lib/supportLinks'

type DirectEmailSupportProps = {
  className?: string
  compact?: boolean
}

export function DirectEmailSupport({ className = '', compact = false }: DirectEmailSupportProps) {
  const [copied, setCopied] = useState(false)
  const gmailUrl = getGmailComposeUrl()

  async function handleCopy() {
    const ok = await copyTextToClipboard(SITE.supportEmail)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <a
        href={gmailUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-glow-purple to-glow-magenta px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow-purple"
      >
        Email support directly
      </a>
      <div
        className={`flex flex-wrap items-center gap-2 ${compact ? 'justify-start' : 'justify-center sm:justify-start'}`}
      >
        <a
          href={gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sm text-slate-300 underline-offset-2 hover:text-white hover:underline"
        >
          {SITE.supportEmail}
        </a>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded-lg border border-ink-border bg-ink/60 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:border-glow-purple/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow-purple"
        >
          {copied ? 'Copied' : 'Copy email'}
        </button>
      </div>
    </div>
  )
}
