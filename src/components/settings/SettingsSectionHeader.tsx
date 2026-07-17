import type { ReactNode } from 'react'

type SettingsSectionHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
}

/** Shared Settings section title — larger and heavier than form labels. */
export function SettingsSectionHeader({
  title,
  description,
  action,
}: SettingsSectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-surface-border bg-gradient-to-r from-accent/10 via-transparent to-accent-blue/5 px-5 py-5 sm:px-6">
      <div className="min-w-0">
        <h2 className="settings-section-title">{title}</h2>
        {description ? <p className="settings-section-desc">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
    </div>
  )
}
