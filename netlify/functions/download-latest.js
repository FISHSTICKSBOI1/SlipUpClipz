const GITHUB_API =
  'https://api.github.com/repos/FISHSTICKSBOI1/SlipUpClipz/releases/latest'
const RELEASES_PAGE =
  'https://github.com/FISHSTICKSBOI1/SlipUpClipz/releases/latest'

const EXCLUDED_SUFFIXES = ['.blockmap', '.yml', '.zip', '.tar.gz']

function isInstallerAsset(name) {
  const lower = name.toLowerCase()
  if (!lower.endsWith('.exe')) return false
  if (!lower.includes('slipupclipz')) return false
  if (!lower.includes('setup')) return false
  if (lower.includes('__uninstaller')) return false
  if (EXCLUDED_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return false
  return true
}

export async function handler() {
  try {
    const response = await fetch(GITHUB_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'SlipUpClipz-Website',
      },
    })

    if (!response.ok) {
      return {
        statusCode: 302,
        headers: {
          Location: RELEASES_PAGE,
          'Cache-Control': 'public, max-age=300',
        },
      }
    }

    const release = await response.json()
    const installer = release.assets?.find((asset) => isInstallerAsset(asset.name))

    if (!installer?.browser_download_url) {
      return {
        statusCode: 302,
        headers: {
          Location: RELEASES_PAGE,
          'Cache-Control': 'public, max-age=300',
        },
      }
    }

    return {
      statusCode: 302,
      headers: {
        Location: installer.browser_download_url,
        'Cache-Control': 'public, max-age=600',
      },
    }
  } catch {
    return {
      statusCode: 302,
      headers: {
        Location: RELEASES_PAGE,
        'Cache-Control': 'public, max-age=300',
      },
    }
  }
}
