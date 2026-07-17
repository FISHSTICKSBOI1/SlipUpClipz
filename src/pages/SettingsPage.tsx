import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAppSettings } from '../context/AppSettingsContext'
import { useLicense } from '../context/LicenseContext'
import { isElectronApp } from '../lib/electronBridge'
import { playToggleSound } from '../lib/uiSounds'
import { AudioOutputSection } from '../components/settings/AudioOutputSection'
import { HelpSupportSection } from '../components/settings/HelpSupportSection'
import { SettingsSectionHeader } from '../components/settings/SettingsSectionHeader'
import { UpdatesSection } from '../components/settings/UpdatesSection'
import { LicenseSection } from '../components/license/LicenseSection'
import { PaywallNotice } from '../components/license/PaywallNotice'

export function SettingsPage() {
  const { settings, isLoading, updateSettings } = useAppSettings()
  const { isPro } = useLicense()
  const [appVersion, setAppVersion] = useState('0.1.0')

  useEffect(() => {
    void window.electronAPI?.app.getVersion().then((info) => setAppVersion(info.version))
  }, [])

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
    if ((key === 'launchOnStartup' || key === 'globalHotkeysEnabled') && !isPro) {
      return
    }

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

      <LicenseSection />

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
        {isPro ? (
          <ToggleRow
            label="Global hotkeys"
            description="Play assigned clips with keyboard shortcuts even when SlipUpClipz is in the background."
            checked={settings.globalHotkeysEnabled}
            onChange={() => void toggle('globalHotkeysEnabled')}
          />
        ) : (
          <div className="py-4">
            <PaywallNotice feature="globalHotkeys" />
            <p className="mt-3 text-xs text-ink-muted">
              Free plan still supports in-app hotkeys while SlipUpClipz is focused.
            </p>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Window" description="Control startup and window behavior.">
        {isPro ? (
          <ToggleRow
            label="Launch on startup"
            description="Open SlipUpClipz automatically when you sign in to Windows."
            checked={settings.launchOnStartup}
            onChange={() => void toggle('launchOnStartup')}
          />
        ) : (
          <div className="py-4">
            <PaywallNotice feature="autoStart" compact />
          </div>
        )}
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
          <span className="text-sm text-ink-soft">{appVersion}</span>
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
