/** Which teammate-routing choices belong on the main soundboard screen. */
export function showTeammateDeviceChoices(input: {
  wantsTeammates: boolean
  hasCable: boolean
  microphoneReady: boolean
  headphonesReady: boolean
}): boolean {
  return input.wantsTeammates && input.hasCable && (!input.microphoneReady || !input.headphonesReady)
}

export function teammateStatus(input: {
  enabled: boolean
  sending: boolean
  hasCable: boolean
}): 'local' | 'on' | 'connecting' | 'needs-cable' {
  if (!input.enabled) return 'local'
  if (!input.hasCable) return 'needs-cable'
  if (!input.sending) return 'connecting'
  return 'on'
}

/** Status the main screen can stand behind. The game itself is not checked. */
export function teammateStatusText(
  status: 'local' | 'on' | 'connecting' | 'needs-cable',
  notice?: string | null,
): string {
  if (status === 'on') return 'Sending sounds to voice chat'
  if (status === 'needs-cable') return 'A virtual cable is needed before teammates can hear sounds'
  if (status === 'connecting') return notice?.trim() || 'Connecting your microphone'
  return 'Only you hear sounds'
}
