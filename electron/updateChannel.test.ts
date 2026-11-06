import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  githubNsisUpdatesAllowed,
  isMicrosoftStorePackage,
  isNewerRelease,
  MICROSOFT_STORE_LISTING_URL,
  updateDistribution,
} from '../shared/updateChannel.js'
import { readFileSync } from 'node:fs'

describe('update channel', () => {
  it('treats a Microsoft Store package as Store-updated', () => {
    assert.equal(isMicrosoftStorePackage(true), true)
    assert.equal(isMicrosoftStorePackage(false), false)
    assert.equal(isMicrosoftStorePackage(undefined), false)
    assert.equal(
      isMicrosoftStorePackage(
        false,
        'C:\\Program Files\\WindowsApps\\SlipUpClipzLLC.SlipUpClipz_1.0.6.0_x64__z6z50n1zy6nqj\\SlipUpClipz.exe',
      ),
      true,
    )
    assert.equal(
      isMicrosoftStorePackage(false, 'C:\\Program Files\\SlipUpClipz\\SlipUpClipz.exe'),
      false,
    )
    assert.equal(MICROSOFT_STORE_LISTING_URL.includes('9N89SSLR9769'), true)
    assert.equal(MICROSOFT_STORE_LISTING_URL.startsWith('ms-windows-store://'), true)
  })

  it('isolates Store, NSIS, and unpackaged update paths', () => {
    assert.equal(updateDistribution({ packaged: true, windowsStore: true }), 'microsoft-store')
    assert.equal(githubNsisUpdatesAllowed('microsoft-store'), false)
    assert.equal(updateDistribution({ packaged: false, windowsStore: true }), 'microsoft-store')
    assert.equal(updateDistribution({ packaged: false, windowsStore: false }), 'unpackaged')
    assert.equal(githubNsisUpdatesAllowed('unpackaged'), false)
    assert.equal(updateDistribution({ packaged: true, windowsStore: false }), 'github')
    assert.equal(githubNsisUpdatesAllowed('github'), true)
    assert.equal(
      updateDistribution({
        packaged: true,
        windowsStore: false,
        execPath: 'C:\\Program Files\\WindowsApps\\SlipUpClipzLLC.SlipUpClipz_1.0.6.0_x64__z6z50n1zy6nqj\\SlipUpClipz.exe',
      }),
      'microsoft-store',
    )
    assert.equal(
      updateDistribution({
        packaged: true,
        windowsStore: false,
        execPath: 'C:\\Program Files\\SlipUpClipz\\SlipUpClipz.exe',
      }),
      'github',
    )
    assert.equal(
      updateDistribution({
        packaged: false,
        windowsStore: false,
        execPath: 'C:\\Users\\dev\\SlipUpClipz\\node_modules\\electron\\dist\\electron.exe',
      }),
      'unpackaged',
    )

    const updater = readFileSync(new URL('./updater.ts', import.meta.url), 'utf8')
    assert.equal(updater.includes('execPath: process.execPath'), true)
    assert.equal(updater.includes('if (!githubNsisUpdatesAllowed(distribution))'), true)
    assert.equal(updater.includes('console.warn(\'[autoUpdater] quitAndInstall ignored for this installation\')\n  }'), false)
    assert.match(updater, /if \(distribution === 'microsoft-store'\) \{\s*return storeManagedState\(\)/)
    assert.equal(updater.includes('if (!app.isPackaged) {\n  if (isMicrosoftStorePackage'), false)

    const identity = JSON.parse(
      readFileSync(new URL('../build/microsoft-store.identity.json', import.meta.url), 'utf8'),
    ) as { identityName?: string }
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      build?: { appx?: { identityName?: string } }
    }
    assert.equal(identity.identityName, 'SlipUpClipzLLC.SlipUpClipz')
    assert.equal(pkg.build?.appx?.identityName, 'SlipUpClipzLLC.SlipUpClipz')
    assert.equal(isMicrosoftStorePackage(true), true)
  })

  it('rejects the current version and older installers', () => {
    assert.equal(isNewerRelease('0.1.5', '0.1.6'), true)
    assert.equal(isNewerRelease('0.1.6', '0.1.6'), false)
    assert.equal(isNewerRelease('0.1.6', '0.1.5'), false)
    assert.equal(isNewerRelease('0.1.5', '0.1.5-dev'), false)
  })
})
