import { shell } from 'electron'
import { isAllowedExternalUrl } from '../shared/externalLinks.js'

export function openExternalUrl(url: string): void {
  if (!isAllowedExternalUrl(url)) {
    return
  }

  void shell.openExternal(url)
}
