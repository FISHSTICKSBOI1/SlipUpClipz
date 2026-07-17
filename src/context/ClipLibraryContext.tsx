import { createContext, useContext, type ReactNode } from 'react'
import { useClipLibrary, type ClipLibrary } from '../hooks/useClipLibrary'
import {
  useElectronHotkeyTrigger,
  useSoundboardHotkeys,
} from '../hooks/useSoundboardHotkeys'
import { useAppSettings } from './AppSettingsContext'
import { useLicense } from './LicenseContext'

const ClipLibraryContext = createContext<ClipLibrary | null>(null)

function SoundboardHotkeyListener({ library }: { library: ClipLibrary }) {
  const { isPro } = useLicense()
  const { settings } = useAppSettings()

  const globalHotkeysAllowed = isPro && settings.globalHotkeysEnabled

  useSoundboardHotkeys(library.clips, library.playClipSoundboard, {
    enabled: settings.globalHotkeysEnabled,
    useSystemGlobalHotkeys: globalHotkeysAllowed,
  })

  useElectronHotkeyTrigger(library.playClipSoundboard, globalHotkeysAllowed)

  return null
}

export function ClipLibraryProvider({ children }: { children: ReactNode }) {
  const library = useClipLibrary()

  return (
    <ClipLibraryContext.Provider value={library}>
      <SoundboardHotkeyListener library={library} />
      {children}
    </ClipLibraryContext.Provider>
  )
}

export function useClipLibraryContext(): ClipLibrary {
  const context = useContext(ClipLibraryContext)
  if (!context) {
    throw new Error('useClipLibraryContext must be used within ClipLibraryProvider')
  }
  return context
}
