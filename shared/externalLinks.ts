/**
 * Placeholder product URLs — update these when the public site goes live.
 */
export const EXTERNAL_LINKS = {
  website: 'https://slipupclipz.com',
  /** Public purchase page: website/src/config/site.ts websiteUrl + paths.pricing. */
  pricing: 'https://slipupclipz.com/pricing',
  /**
   * Local pricing page section only. The public site does not serve this section yet,
   * so the desktop app must not send customers here until it is deployed.
   */
  manageSubscription: 'https://slipupclipz.com/pricing#manage',
  helpCenter: 'https://slipupclipz.com/help',
  contactSupport: 'https://slipupclipz.com/contact',
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
