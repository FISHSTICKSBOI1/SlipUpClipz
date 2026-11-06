type PlaybackListener = (activeId: string) => void

const listeners = new Set<PlaybackListener>()

export function claimAudioPlayback(activeId: string) {
  for (const listener of listeners) listener(activeId)
}

export function subscribeAudioPlayback(listener: PlaybackListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
