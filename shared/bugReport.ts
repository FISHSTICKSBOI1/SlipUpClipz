/** Text the user chooses to paste into the public contact form. The app does not upload it. */

const LICENSE_KEY = /SLIP-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2}/gi
const WINDOWS_PATH = /[A-Za-z]:\\[^\r\n]+/g
const UNC_PATH = /\\\\[^\r\n]+/g
const USER_PROFILE_PATH = /(?:\/Users\/|\/home\/)[^\s]+/g

export function redactSensitiveText(value: string): string {
  return value
    .replace(LICENSE_KEY, '[license key removed]')
    .replace(WINDOWS_PATH, '[path removed]')
    .replace(UNC_PATH, '[path removed]')
    .replace(USER_PROFILE_PATH, '[path removed]')
}

export function buildBugReport(input: {
  description: string
  version: string | null
  includeDiagnostics: boolean
  platform?: string
  plan?: 'Free' | 'Pro'
  voiceCloning?: 'ready' | 'not ready' | 'unknown'
}): string {
  const description = redactSensitiveText(input.description.trim())
  const lines = [description, '', `App version: ${input.version?.trim() || 'unknown'}`]
  if (input.includeDiagnostics) {
    lines.push(`Platform: ${input.platform?.trim() || 'unknown'}`)
    lines.push(`Plan: ${input.plan ?? 'unknown'}`)
    lines.push(`Voice Cloning: ${input.voiceCloning ?? 'unknown'}`)
  }
  lines.push('', 'No recording, transcript, or license key is included.')
  return lines.join('\n')
}
