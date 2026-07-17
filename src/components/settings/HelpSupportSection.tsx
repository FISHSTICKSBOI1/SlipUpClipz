import { EXTERNAL_LINKS, openExternalLink } from '../../lib/externalLinks'
import { useOnboardingTour } from '../../context/OnboardingTourContext'
import { SettingsSectionHeader } from './SettingsSectionHeader'

export function HelpSupportSection() {
  const { startTour, isActive } = useOnboardingTour()

  return (
    <section className="panel overflow-hidden">
      <SettingsSectionHeader
        title="Help & Support"
        description="Guides, contact options, and the first-run tour."
      />

      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openExternalLink(EXTERNAL_LINKS.helpCenter)}
            className="btn-secondary !px-3 !py-2 !text-xs"
          >
            Open Help Center
          </button>
          <button
            type="button"
            onClick={() => openExternalLink(EXTERNAL_LINKS.contactSupport)}
            className="btn-secondary !px-3 !py-2 !text-xs"
          >
            Contact Support
          </button>
          <button
            type="button"
            disabled={isActive}
            onClick={startTour}
            className="btn-secondary !px-3 !py-2 !text-xs"
          >
            Restart Guided Tour
          </button>
        </div>

        <p className="text-xs leading-relaxed text-ink-muted">
          Opens the SlipUpClipz Help Center and Contact pages in your browser.
        </p>

        <button
          type="button"
          onClick={() => openExternalLink(EXTERNAL_LINKS.helpCenter)}
          className="w-full rounded-xl border border-dashed border-surface-border bg-surface-overlay/40 px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-surface-overlay/60"
        >
          <p className="text-sm font-medium text-ink-soft">Open Support Assistant</p>
          <p className="mt-1 text-xs text-ink-muted">
            Get troubleshooting help on slipupclipz.com/help in your browser.
          </p>
        </button>
      </div>
    </section>
  )
}
