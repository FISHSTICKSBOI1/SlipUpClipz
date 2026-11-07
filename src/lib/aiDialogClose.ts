/** Close and cancellation decisions for the AI Voice Clone dialog. */

export type AiCloseChoice = 'close' | 'escape' | 'keep' | 'stop'
export type AiCloseAction = 'close' | 'ask' | 'keep' | 'stop'

export function aiCloseAction(input: {
  generating: boolean
  confirmOpen: boolean
  choice: AiCloseChoice
}): AiCloseAction {
  if (input.confirmOpen) {
    return input.choice === 'stop' ? 'stop' : 'keep'
  }
  if (input.generating && (input.choice === 'close' || input.choice === 'escape')) return 'ask'
  if (!input.generating && (input.choice === 'close' || input.choice === 'escape')) return 'close'
  return 'keep'
}

export function acceptGenerationResult(input: {
  requestId: string
  cancelledRequestId: string
  dialogOpen: boolean
  clipMatches: boolean
}): boolean {
  if (!input.dialogOpen || !input.clipMatches) return false
  return input.cancelledRequestId === '' || input.cancelledRequestId !== input.requestId
}
