import { VB_AUDIO_CABLE_URL } from '../../lib/audioDevices'

export function VirtualAudioSetupPanel({ compact = false }: { compact?: boolean }) {
  function openVBCableWebsite() {
    window.open(VB_AUDIO_CABLE_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className={`rounded-lg border border-amber-500/20 bg-amber-500/5 ${
        compact ? 'px-3 py-3' : 'px-4 py-4'
      }`}
    >
      <p className={`font-medium text-amber-100 ${compact ? 'text-xs' : 'text-sm'}`}>
        Set up virtual audio routing
      </p>
      <p className={`mt-2 leading-relaxed text-amber-200/80 ${compact ? 'text-[11px]' : 'text-xs'}`}>
        To use SlipUpClipz as your microphone in Discord or games, install a virtual audio device
        such as VB-Audio Virtual Cable. Then select it as your soundboard output below and set it
        as your microphone input in Discord or your game.
      </p>
      <button
        type="button"
        onClick={openVBCableWebsite}
        className={`mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 font-medium text-amber-100 transition-colors hover:bg-amber-500/20 ${
          compact ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-xs'
        }`}
      >
        Get VB-Audio Virtual Cable
      </button>
    </div>
  )
}
