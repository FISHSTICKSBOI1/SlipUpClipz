import { Link } from 'react-router-dom'
import { PREMIUM_FEATURES } from '@shared/appTypes'

type PaywallNoticeProps = {
  feature: keyof typeof PREMIUM_FEATURES
  compact?: boolean
}

export function PaywallNotice({ feature, compact = false }: PaywallNoticeProps) {
  return (
    <div
      className={`rounded-lg border border-amber-500/20 bg-amber-500/10 ${
        compact ? 'px-3 py-2' : 'px-4 py-3'
      }`}
    >
      <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-amber-300`}>
        Pro feature
      </p>
      <p className={`mt-1 ${compact ? 'text-[11px]' : 'text-xs'} leading-relaxed text-amber-100/80`}>
        {PREMIUM_FEATURES[feature]}
      </p>
      <Link
        to="/settings#license"
        className={`mt-2 inline-block ${compact ? 'text-[11px]' : 'text-xs'} font-medium text-accent-hover hover:text-accent`}
      >
        Upgrade in Settings
      </Link>
    </div>
  )
}
