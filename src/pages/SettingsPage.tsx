import { useEffect, useState, type ReactNode } from 'react'
import { useAppVersion } from '../hooks/useAppVersion'
import { Link, useLocation } from 'react-router-dom'
import { readUpgradeFocus } from '@shared/upgradeNavigation'
import { useAppSettings } from '../context/AppSettingsContext'
import { isElectronApp } from '../lib/electronBridge'
import { playToggleSound } from '../lib/uiSounds'
import { scrollLicenseSectionIntoView } from '../lib/upgradeScroll'
import { AudioOutputSection } from '../components/settings/AudioOutputSection'
import { HelpSupportSection } from '../components/settings/HelpSupportSection'
import { SettingsSectionHeader } from '../components/settings/SettingsSectionHeader'
import { AiRuntimeSection } from '../components/settings/AiRuntimeSection'
import { UpdatesSection } from '../components/settings/UpdatesSection'
import { LicenseSection } from '../components/license/LicenseSection'

export function SettingsPage() {
  const { settings, isLoading, updateSettings } = useAppSettings()
  const appVersion = useAppVersion()
  const upgradeFocus = readUpgradeFocus(useLocation().state)
  const [licenseHighlight, setLicenseHighlight] = useState(false)

  useEffect(() => {
    if (isLoading || upgradeFocus == null) return
    const section = document.getElementById('license')
    if (!(section instanceof HTMLElement)) return
    scrollLicenseSectionIntoView(section)
    setLicenseHighlight(false)
    const frame = window.requestAnimationFrame(() => setLicenseHighlight(true))
    const timer = window.setTimeout(() => setLicenseHighlight(false), 1700)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [isLoading, upgradeFocus])

  useEffect(() => {
    if (isLoading) return
    if (!isElectronApp() || !window.electronAPI?.app.getLoginItemSettings) return

    void window.electronAPI.app.getLoginItemSettings().then((osState) => {
      if (osState.openAtLogin !== settings.launchOnStartup) {
        void updateSettings({ launchOnStartup: osState.openAtLogin })
      }
    })
    // Sync once when Settings finishes loading against the real OS startup state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  async function toggle(
    key:
      | 'launchOnStartup'
      | 'minimizeToTray'
      | 'showRightPanel'
      | 'compactSidebar'
      | 'globalHotkeysEnabled'
      | 'allowF11Fullscreen',
  ) {
    const nextValue = !settings[key]
    playToggleSound(nextValue)
    await updateSettings({ [key]: nextValue })
  }

  if (isLoading) {
    return <p className="text-sm text-ink-muted">Loading settings...</p>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-desc">
          Audio routing, startup behavior, licensing, and workspace preferences.
        </p>
      </div>

      <LicenseSection className={licenseHighlight ? 'upgrade-highlight' : ''} />

      <AiRuntimeSection />

      <SettingsSection
        title="Clip Capture"
        description="Replay source and clip hotkey live on the Clips page next to the recorder."
      >
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="text-sm font-medium text-white">Replay audio source &amp; clip hotkey</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Configure what the buffer records and the global clip shortcut from Clips.
            </p>
          </div>
          <Link to="/clips" className="btn-secondary !px-3 !py-2 !text-xs">
            Open Clips
          </Link>
        </div>
      </SettingsSection>

      <AudioOutputSection />

      <SettingsSection title="Hotkeys" description="Control soundboard shortcut behavior.">
        <ToggleRow
          label="Global hotkeys"
          description="Play assigned clips with keyboard shortcuts even when SlipUpClipz is in the background."
          checked={settings.globalHotkeysEnabled}
          onChange={() => void toggle('globalHotkeysEnabled')}
        />
      </SettingsSection>

      <SettingsSection title="Window" description="Control startup and window behavior.">
        <ToggleRow
          label="Launch on startup"
          description="Open SlipUpClipz automatically when you sign in to Windows."
          checked={settings.launchOnStartup}
          onChange={() => void toggle('launchOnStartup')}
        />
        <ToggleRow
          label="Close to tray"
          description="Hide to the system tray when closing the window (X). Minimize always uses the Windows taskbar. Quit from the tray menu to exit fully."
          checked={settings.minimizeToTray}
          onChange={() => void toggle('minimizeToTray')}
        />
        <ToggleRow
          label="Allow F11 fullscreen"
          description="Press F11 to enter or exit fullscreen. Escape also exits fullscreen. Maximize stays separate."
          checked={settings.allowF11Fullscreen}
          onChange={() => void toggle('allowF11Fullscreen')}
        />
      </SettingsSection>

      <SettingsSection title="Appearance" description="Visual preferences for the workspace.">
        <ToggleRow
          label="Show details panel"
          description="Display the right-hand info panel on wide screens."
          checked={settings.showRightPanel}
          onChange={() => void toggle('showRightPanel')}
        />
        <ToggleRow
          label="Compact sidebar"
          description="Use a narrower navigation sidebar with icons only."
          checked={settings.compactSidebar}
          onChange={() => void toggle('compactSidebar')}
        />
      </SettingsSection>

      <HelpSupportSection />

      <UpdatesSection />

      <SettingsSection title="About" description="Application information.">
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium text-white">Version</p>
            <p className="mt-1 text-xs text-ink-muted">SlipUpClipz desktop client</p>
          </div>
          <span className="text-sm text-ink-soft">{appVersion ?? '…'}</span>
        </div>
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium text-white">Platform</p>
            <p className="mt-1 text-xs text-ink-muted">Detected from Electron</p>
          </div>
          <span className="text-sm capitalize text-ink-soft">
            {isElectronApp() ? window.electronAPI?.platform ?? 'desktop' : 'web preview'}
          </span>
        </div>
      </SettingsSection>
    </div>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="panel overflow-hidden">
      <SettingsSectionHeader title={title} description={description} />
      <div className="divide-y divide-surface-border px-5 sm:px-6">{children}</div>
    </section>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={`toggle-track ${checked ? 'bg-accent' : 'bg-surface-border'}`}
      >
        <span className={`toggle-thumb ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}
