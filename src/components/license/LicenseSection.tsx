import { useState } from 'react'
import { useLicense } from '../../context/LicenseContext'
import { SettingsSectionHeader } from '../settings/SettingsSectionHeader'

export function LicenseSection() {
  const { license, isPro, activate, deactivate } = useLicense()
  const [keyInput, setKeyInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleActivate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await activate(keyInput)
    setIsSubmitting(false)

    if (result.ok) {
      setKeyInput('')
      return
    }

    setError(result.error ?? 'Could not activate license.')
  }

  return (
    <section id="license" className="panel overflow-hidden">
      <SettingsSectionHeader
        title="License"
        description="Unlock global hotkeys, VB-Audio Cable routing, auto-start, and all soundboard pads."
        action={
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              isPro ? 'bg-clip/15 text-clip-hover' : 'bg-surface-overlay text-ink-muted'
            }`}
          >
            {isPro ? 'Pro' : 'Free'}
          </span>
        }
      />

      <div className="space-y-4 px-5 py-5 sm:px-6">
        {isPro ? (
          <>
            <div className="rounded-xl border border-clip/25 bg-clip/10 px-4 py-3">
              <p className="text-sm font-medium text-clip-hover">Pro activated</p>
              <p className="mt-1 font-mono text-xs text-emerald-100/80">{license.key}</p>
              {license.activatedAt && (
                <p className="mt-1 text-[11px] text-emerald-100/60">
                  Activated {new Date(license.activatedAt).toLocaleString()}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void deactivate()}
              className="text-xs text-ink-muted transition-colors hover:text-red-400"
            >
              Deactivate license on this device
            </button>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-ink-muted">
              Enter your Pro license key below to unlock all Pro features.
            </p>
            <ul className="space-y-2 text-xs text-ink-muted">
              <li>Free: 3 soundboard pads, in-app hotkeys only, default audio output</li>
              <li>Pro: 50 pads, system-wide hotkeys, VB-Cable routing, Windows auto-start</li>
            </ul>

            <form onSubmit={(event) => void handleActivate(event)} className="space-y-3">
              <label className="block">
                <span className="field-label">License key</span>
                <input
                  value={keyInput}
                  onChange={(event) => setKeyInput(event.target.value.toUpperCase())}
                  placeholder="SLIP-XXXX-XXXX-XXXX"
                  className="field-input mt-1.5 font-mono"
                />
              </label>

              {error && <p className="text-xs text-red-300">{error}</p>}

              <button
                type="submit"
                disabled={!keyInput.trim() || isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? 'Activating...' : 'Activate Pro'}
              </button>
            </form>

            <p className="text-xs text-ink-faint">
              Purchase a key at{' '}
              <span className="text-ink-muted">slipupclipz.com</span>.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
