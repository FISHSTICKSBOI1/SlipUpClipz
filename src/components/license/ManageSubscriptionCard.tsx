import { EXTERNAL_LINKS, openExternalLink } from '../../lib/externalLinks'

/**
 * The public site does not include pricing#manage yet, and the public billing
 * function is not deployed. Contact support is the live cancellation path.
 */
export function ManageSubscriptionLink() {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => openExternalLink(EXTERNAL_LINKS.contactSupport)}
        className="text-sm font-medium text-white underline decoration-white/30 underline-offset-2 transition-colors hover:decoration-white"
      >
        Manage subscription
      </button>
      <p className="text-xs leading-relaxed text-ink-faint">
        Subscription management is not on the public website yet. Contact support to cancel
        renewal or recover a lost key. Removing the license from this PC does not cancel billing.
      </p>
    </div>
  )
}
