/** Which failures may offer a manual AI-engine restart. Nothing here restarts by itself. */

export type AiRecoveryAction = 'none' | 'restart-engine'

const RESTART_ENGINE = [
  /took too long to start/i,
  /took too long to finish/i,
  /failed to start/i,
  /stopped before/i,
  /still working/i,
  /paging file|virtual-memory|os error 1455|out of memory|free memory/i,
  /voice model files are not installed/i,
  /supported NVIDIA GPU/i,
]

const NO_RESTART = [
  /will not stop that program/i,
  /another program is using the local AI port/i,
  /already in use/i,
  /still starting/i,
  /speaker permission/i,
  /permission box/i,
  /reference transcript/i,
  /pro feature/i,
  /generation was stopped/i,
  /enter the words manually/i,
  /invalid reference/i,
  /no saved audio/i,
]

export function aiRecoveryAction(message: string): AiRecoveryAction {
  const text = message
    .replace(/Error invoking remote method '[^']+':\s*/gi, '')
    .replace(/^Error:\s*/i, '')
    .trim()
  if (!text || NO_RESTART.some((pattern) => pattern.test(text))) return 'none'
  return RESTART_ENGINE.some((pattern) => pattern.test(text)) ? 'restart-engine' : 'none'
}
