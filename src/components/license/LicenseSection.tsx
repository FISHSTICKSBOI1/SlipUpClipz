import { useState } from 'react'
import { FREE_SOUNDBOARD_PAD_LIMIT, PREMIUM_FEATURES, PRO_SOUNDBOARD_PAD_LIMIT } from '@shared/appTypes'
import { VOICE_CLONING_MIN_FREE_BYTES, voiceCloningStorageRequirement } from '@shared/voiceInstallStorage'
import { useAppSettings } from '../../context/AppSettingsContext'
import { useLicense } from '../../context/LicenseContext'
import { EXTERNAL_LINKS, openExternalLink } from '../../lib/externalLinks'
import { playToggleSound } from '../../lib/uiSounds'
import { SettingsSectionHeader } from '../settings/SettingsSectionHeader'
import { ManageSubscriptionLink } from './ManageSubscriptionCard'

export function LicenseSection({ className = '' }: { className?: string }) {
  const { license, access, developmentBuild, activate, deactivate } = useLicense()
  const { settings, updateSettings } = useAppSettings()
  const [keyInput, setKeyInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [transferEmail, setTransferEmail] = useState('')
  const [transferCode, setTransferCode] = useState('')
  const [transferMessage, setTransferMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const needsTransfer = Boolean(error?.includes('another computer'))

  async function handleActivate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setTransferMessage(null)
    setIsSubmitting(true)

    const result = await activate(keyInput)
    setIsSubmitting(false)

    if (result.ok) {
      setKeyInput('')
      return
    }

    setError(result.error ?? 'Could not activate license.')
  }

  async function handleRemove() {
    const result = await deactivate()
    if (result.warning) setError(result.warning)
  }

  async function handleTransferRequest(event: React.FormEvent) {
    event.preventDefault()
    if (!window.electronAPI?.license.requestTransfer) return
    setIsTransferring(true)
    setTransferMessage(null)
    const result = await window.electronAPI.license.requestTransfer({
      licenseKey: keyInput,
      email: transferEmail,
    })
    setIsTransferring(false)
    if (!result.ok) {
      setError(result.error ?? 'Could not send a transfer code.')
      return
    }
    setTransferMessage(result.message ?? 'Check the purchase email for a transfer code.')
  }

  async function handleTransferConfirm(event: React.FormEvent) {
    event.preventDefault()
    if (!window.electronAPI?.license.confirmTransfer) return
    setIsTransferring(true)
    const confirmed = await window.electronAPI.license.confirmTransfer({
      licenseKey: keyInput,
      code: transferCode,
    })
    if (!confirmed.ok) {
      setIsTransferring(false)
      setError(confirmed.error ?? 'This transfer code is invalid or expired.')
      return
    }
    const activated = await activate(keyInput)
    setIsTransferring(false)
    if (!activated.ok) {
      setError(activated.error ?? 'The transfer was saved, but activation did not finish. Try Activate Pro again.')
      return
    }
    setKeyInput('')
    setTransferCode('')
    setError(null)
  }

  return (
    <section id="license" className={`panel overflow-hidden ${className}`.trim()}>
      <SettingsSectionHeader
        title="License"
        description="Pro adds AI Voice Cloning and the full 50-pad soundboard."
        action={
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              access === 'license'
                ? 'bg-clip/15 text-clip-hover'
                : access === 'development'
                  ? 'bg-amber-500/15 text-amber-200'
                  : 'bg-surface-overlay text-ink-muted'
            }`}
          >
            {access === 'license' ? 'Pro' : access === 'development' ? 'Dev Pro' : 'Free'}
          </span>
        }
      />

      <div className="space-y-4 px-5 py-5 sm:px-6">
        {developmentBuild && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-amber-100">Development Pro</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                Simulates Pro in this unpackaged development app. This is not a customer license
                and does nothing in an installed build.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.devProTesting}
              onClick={() => {
                const nextValue = !settings.devProTesting
                playToggleSound(nextValue)
                void updateSettings({ devProTesting: nextValue })
              }}
              className={`toggle-track ${settings.devProTesting ? 'bg-amber-400' : 'bg-surface-border'}`}
            >
              <span
                className={`toggle-thumb ${settings.devProTesting ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        )}

        {access === 'license' ? (
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
            <p className="text-xs leading-relaxed text-ink-muted">
              {voiceCloningStorageRequirement(VOICE_CLONING_MIN_FREE_BYTES)}
            </p>
            <ManageSubscriptionLink />
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => void handleRemove()}
                className="text-xs text-ink-muted transition-colors hover:text-red-400"
              >
                Remove license from this device
              </button>
              <p className="text-xs leading-relaxed text-ink-faint">
                This removes the key from this PC and frees it for one other computer. It does
                not cancel the subscription, delete clips, or change the paid period. If this
                computer is offline, use Transfer on the new computer with the purchase email.
              </p>
            </div>
          </>
        ) : (
          <>
            {access === 'development' && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-sm font-medium text-amber-100">Development Pro is on</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                  {license.devDemo
                    ? 'A development demo key is saved on this device. It was not checked with the license server.'
                    : 'Pro features are simulated locally. This does not mean a real license activated.'}
                </p>
              </div>
            )}
            {license.devDemo && (
              <button
                type="button"
                onClick={() => void handleRemove()}
                className="text-xs text-ink-muted transition-colors hover:text-red-400"
              >
                Remove development demo key
              </button>
            )}
            <p className="text-sm leading-relaxed text-ink-muted">
              {access === 'development'
                ? 'Enter a real license key below to test customer activation. Development Pro does not count as that test.'
                : 'Enter your Pro license key below to unlock all Pro features.'}
            </p>
            <ul className="space-y-2 text-xs text-ink-muted">
              <li>
                Free: {FREE_SOUNDBOARD_PAD_LIMIT} soundboard pads, global hotkeys, VB-Audio Cable
                routing, and Windows startup
              </li>
              <li>
                Pro: {PRO_SOUNDBOARD_PAD_LIMIT} soundboard pads and {PREMIUM_FEATURES.aiVoice}
              </li>
              <li>{voiceCloningStorageRequirement(VOICE_CLONING_MIN_FREE_BYTES)}</li>
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

              {needsTransfer && (
                <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <p className="text-xs leading-relaxed text-ink-muted">
                    Pro works on one computer at a time. If the old computer is available, remove
                    the license there first. If it is lost or unavailable, confirm the purchase
                    email. The code moves the license here without changing the paid period.
                  </p>
                  <form onSubmit={(event) => void handleTransferRequest(event)} className="space-y-2">
                    <label className="block">
                      <span className="field-label">Purchase email</span>
                      <input
                        type="email"
                        value={transferEmail}
                        onChange={(event) => setTransferEmail(event.target.value)}
                        className="field-input mt-1.5"
                        autoComplete="email"
                        required
                      />
                    </label>
                    <button type="submit" disabled={isTransferring} className="btn-secondary">
                      Email transfer code
                    </button>
                  </form>
                  <form onSubmit={(event) => void handleTransferConfirm(event)} className="space-y-2">
                    <label className="block">
                      <span className="field-label">Transfer code</span>
                      <input
                        value={transferCode}
                        onChange={(event) => setTransferCode(event.target.value.toUpperCase())}
                        className="field-input mt-1.5 font-mono"
                        autoComplete="one-time-code"
                        required
                      />
                    </label>
                    <button type="submit" disabled={isTransferring} className="btn-secondary">
                      Transfer to this computer
                    </button>
                  </form>
                  {transferMessage && <p className="text-xs text-ink-muted">{transferMessage}</p>}
                </div>
              )}

              <button
                type="submit"
                disabled={!keyInput.trim() || isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? 'Activating...' : 'Activate Pro'}
              </button>
            </form>

            <ManageSubscriptionLink />
            <p className="text-xs text-ink-faint">
              Purchase a key at{' '}
              <button
                type="button"
                onClick={() => openExternalLink(EXTERNAL_LINKS.pricing)}
                className="text-ink-muted underline decoration-ink-faint underline-offset-2 hover:text-white"
              >
                slipupclipz.com
              </button>
              .
            </p>
          </>
        )}
      </div>
    </section>
  )
}
