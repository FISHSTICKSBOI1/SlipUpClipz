import { EXTERNAL_LINKS, isAllowedExternalUrl } from '@shared/externalLinks'

export { EXTERNAL_LINKS }

/**
 * Open an allowlisted https URL in the user's default browser.
 * In Electron, routes through the main-process shell.openExternal handler.
 */
export function openExternalLink(url: string): void {
  if (!isAllowedExternalUrl(url)) {
    return
  }

  const electronOpen = window.electronAPI?.shell?.openExternal
  if (electronOpen) {
    void electronOpen(url)
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
