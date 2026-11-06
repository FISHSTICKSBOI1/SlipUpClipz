import { createContext, useContext, type ReactNode } from 'react'
import { useClipLibrary, type ClipLibrary } from '../hooks/useClipLibrary'
import {
  useElectronHotkeyTrigger,
  useSoundboardHotkeys,
} from '../hooks/useSoundboardHotkeys'
import { useAppSettings } from './AppSettingsContext'

const ClipLibraryContext = createContext<ClipLibrary | null>(null)

function SoundboardHotkeyListener({ library }: { library: ClipLibrary }) {
  const { settings } = useAppSettings()

  useSoundboardHotkeys(library.clips, library.playClipSoundboard, {
    enabled: settings.globalHotkeysEnabled,
    useSystemGlobalHotkeys: settings.globalHotkeysEnabled,
  })

  useElectronHotkeyTrigger(library.playClipSoundboard, settings.globalHotkeysEnabled)

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
