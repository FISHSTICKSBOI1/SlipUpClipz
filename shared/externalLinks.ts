/**
 * Placeholder product URLs — update these when the public site goes live.
 */
export const EXTERNAL_LINKS = {
  website: 'https://slipupclipz.com',
  helpCenter: 'https://slipupclipz.com/help',
  contactSupport: 'https://slipupclipz.com/contact',
  discord: 'https://discord.com/invite/c8wX9AUREj',
} as const

export const ALLOWED_EXTERNAL_HOSTS = new Set([
  'slipupclipz.com',
  'www.slipupclipz.com',
  'discord.com',
  'discord.gg',
  'vb-audio.com',
  'www.vb-audio.com',
])

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') {
      return false
    }

    return ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}
