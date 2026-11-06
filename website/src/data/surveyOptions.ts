export const HEARD_OPTIONS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'search', label: 'Google or another search engine' },
  { id: 'other', label: 'Other' },
] as const

export const DOWNLOAD_OPTIONS = [
  { id: 'microsoft-store', label: 'Microsoft Store' },
  { id: 'website', label: 'Official Website' },
  { id: 'other', label: 'Other' },
] as const

export type HeardOptionId = (typeof HEARD_OPTIONS)[number]['id']
export type DownloadOptionId = (typeof DOWNLOAD_OPTIONS)[number]['id']
