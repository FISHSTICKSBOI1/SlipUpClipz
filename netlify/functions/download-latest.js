const GITHUB_API =
  'https://api.github.com/repos/FISHSTICKSBOI1/SlipUpClipz/releases/latest'
const RELEASES_PAGE =
  'https://github.com/FISHSTICKSBOI1/SlipUpClipz/releases/latest'

function isPreferredWindowsInstaller(name) {
  const lower = String(name).toLowerCase()
  return (
    lower.endsWith('.exe') &&
    !lower.endsWith('.blockmap') &&
    !lower.includes('__uninstaller') &&
    lower.includes('slipupclipz') &&
    lower.includes('setup')
  )
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
    const assets = Array.isArray(release.assets) ? release.assets : []
    const installer = assets.find((asset) => isPreferredWindowsInstaller(asset?.name))

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
