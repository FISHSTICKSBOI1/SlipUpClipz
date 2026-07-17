import { getAudioBlob } from './audioStorage'

let activeAudio: HTMLAudioElement | null = null
let activeObjectUrl: string | null = null

function cleanupActiveAudio() {
  activeAudio?.pause()
  activeAudio = null
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
}

export function stopPlayback(): void {
  cleanupActiveAudio()
}

export async function playClipAudio(
  clipId: string,
  onEnded: () => void,
): Promise<boolean> {
  const blob = await getAudioBlob(clipId)
  if (!blob) return false

  cleanupActiveAudio()

  activeObjectUrl = URL.createObjectURL(blob)
  activeAudio = new Audio(activeObjectUrl)

  activeAudio.onended = () => {
    cleanupActiveAudio()
    onEnded()
  }

  activeAudio.onerror = () => {
    cleanupActiveAudio()
    onEnded()
  }

  await activeAudio.play()
  return true
}
