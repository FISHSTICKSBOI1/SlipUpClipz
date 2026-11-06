import { useState } from 'react'
import { buildBugReport } from '@shared/bugReport'
import { EXTERNAL_LINKS, openExternalLink } from '../../lib/externalLinks'
import { useAppVersion } from '../../hooks/useAppVersion'
import { useLicense } from '../../context/LicenseContext'

export function BugReportPanel() {
  const version = useAppVersion()
  const { isPro } = useLicense()
  const [description, setDescription] = useState('')
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false)
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState('')

  async function prepareReport() {
    let voiceCloning: 'ready' | 'not ready' | 'unknown' = 'unknown'
    let platform: string | undefined
    if (includeDiagnostics) {
      try {
        platform = (await window.electronAPI?.app.getVersion())?.platform
      } catch {
        platform = undefined
      }
      try {
        const runtime = (await window.electronAPI?.aiComponent?.getState())?.runtime
        voiceCloning = runtime === 'ready' ? 'ready' : runtime ? 'not ready' : 'unknown'
      } catch {
        voiceCloning = 'unknown'
      }
    }
    const report = buildBugReport({
      description,
      version,
      includeDiagnostics,
      platform,
      plan: isPro ? 'Pro' : 'Free',
      voiceCloning,
    })
    setDraft(report)
    let copied = false
    try {
      await navigator.clipboard.writeText(report)
      copied = true
    } catch {
      copied = false
    }
    openExternalLink(EXTERNAL_LINKS.contactSupport)
    setNotice(
      copied
        ? 'The report is copied. Paste it into the contact form, choose Bug report, and submit it there. SlipUpClipz did not upload anything.'
        : 'The contact form is open. Copy the report below, choose Bug report, and submit it there. SlipUpClipz did not upload anything.',
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-surface-border bg-surface-overlay/40 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink-soft">Report a bug</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Describe what went wrong. The app version is included. License keys, recordings, transcripts, and file paths are left out.
        </p>
      </div>
      <label className="block">
        <span className="field-label">What happened?</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
          rows={4}
          className="field-input mt-1.5 w-full"
          placeholder="The soundboard pad stayed silent after I assigned a clip."
        />
      </label>
      <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          checked={includeDiagnostics}
          onChange={(event) => setIncludeDiagnostics(event.target.checked)}
        />
        <span>Include basic diagnostics: platform, Free or Pro, and whether Voice Cloning is ready. No audio, transcript, or license key.</span>
      </label>
      <button
        type="button"
        disabled={!description.trim()}
        onClick={() => void prepareReport()}
        className="btn-secondary !px-3 !py-2 !text-xs"
      >
        Continue on the contact form
      </button>
      {notice && <p className="text-xs leading-relaxed text-ink-muted">{notice}</p>}
      {draft && (
        <textarea readOnly value={draft} rows={6} className="field-input w-full font-mono text-[11px]" aria-label="Bug report to paste" />
      )}
    </div>
  )
}
