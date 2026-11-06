#!/usr/bin/env node
/**
 * Builds the Microsoft Store AppX/MSIX package via electron-builder.
 * NSIS website installer is unchanged (use `npm run package` / `npm run release`).
 *
 * The live Store package family is SlipUpClipzLLC.SlipUpClipz_z6z50n1zy6nqj.
 * Keep identityName SlipUpClipzLLC.SlipUpClipz and the same publisher so a new
 * package replaces that installation and keeps its profile. Do not change them.
 *
 * Optional identity overrides (exact Partner Center values):
 *   build/microsoft-store.identity.json
 *   or env: MICROSOFT_STORE_IDENTITY_NAME, MICROSOFT_STORE_PUBLISHER,
 *           MICROSOFT_STORE_PUBLISHER_DISPLAY_NAME, MICROSOFT_STORE_APPLICATION_ID
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const identityPath = path.join(root, 'build', 'microsoft-store.identity.json')
const electronBuilderCli = require.resolve('electron-builder/cli.js')

function readIdentityOverrides() {
  const fromFile = existsSync(identityPath)
    ? JSON.parse(readFileSync(identityPath, 'utf8'))
    : {}

  return {
    identityName:
      process.env.MICROSOFT_STORE_IDENTITY_NAME || fromFile.identityName || undefined,
    publisher: process.env.MICROSOFT_STORE_PUBLISHER || fromFile.publisher || undefined,
    publisherDisplayName:
      process.env.MICROSOFT_STORE_PUBLISHER_DISPLAY_NAME ||
      fromFile.publisherDisplayName ||
      undefined,
    applicationId:
      process.env.MICROSOFT_STORE_APPLICATION_ID || fromFile.applicationId || undefined,
    displayName: fromFile.displayName || undefined,
    // AppX Identity requires Major > 0. The public version stays 0.1.6.
    // 1.0.6.0 is the next Store package version after the published 1.0.5.0.
    storePackageVersion:
      process.env.MICROSOFT_STORE_PACKAGE_VERSION ||
      fromFile.storePackageVersion ||
      '1.0.6',
  }
}

const identity = readIdentityOverrides()
const publicVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
const outputDir = process.env.MSIX_OUTPUT_DIR || 'release-msix'
mkdirSync(path.join(root, outputDir), { recursive: true })

const configArgs = [
  `--config.directories.output=${outputDir}`,
  // Store Identity Version becomes 1.0.6.0; does not modify package.json on disk.
  `--config.extraMetadata.version=${identity.storePackageVersion}`,
  // Keep the output filename aligned with the public product version.
  `--config.appx.artifactName=SlipUpClipz-${publicVersion}.\${ext}`,
]
if (identity.identityName) {
  configArgs.push(`--config.appx.identityName=${identity.identityName}`)
}
if (identity.publisher) {
  configArgs.push(`--config.appx.publisher=${identity.publisher}`)
}
if (identity.publisherDisplayName) {
  configArgs.push(`--config.appx.publisherDisplayName=${identity.publisherDisplayName}`)
}
if (identity.applicationId) {
  configArgs.push(`--config.appx.applicationId=${identity.applicationId}`)
}
if (identity.displayName) {
  configArgs.push(`--config.appx.displayName=${identity.displayName}`)
}

console.log(`[package-msix] Output: ${outputDir}`)
console.log('[package-msix] Identity:', {
  identityName: identity.identityName,
  publisher: identity.publisher,
  publisherDisplayName: identity.publisherDisplayName,
  applicationId: identity.applicationId,
  storePackageVersion: identity.storePackageVersion,
  publicVersion,
})

function findMakeAppx() {
  const cacheRoot = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache')
  const stack = [cacheRoot]
  while (stack.length) {
    const dir = stack.pop()
    let entries = []
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      const full = path.join(dir, name)
      if (name.toLowerCase() === 'makeappx.exe') return full
      try {
        if (statSync(full).isDirectory()) stack.push(full)
      } catch {
        /* ignore */
      }
    }
  }
  return null
}

function stripStoreDownload(appxPath) {
  const makeappx = findMakeAppx()
  if (!makeappx) {
    console.error('[package-msix] makeappx.exe not found in the electron-builder cache')
    process.exit(1)
  }
  const layout = mkdtempSync(path.join(tmpdir(), 'slipupclipz-store-'))
  const packed = `${appxPath}.repacked`
  try {
    execFileSync(makeappx, ['unpack', '/p', appxPath, '/d', layout, '/o', '/nv'], { stdio: 'inherit' })
    const pinPath = path.join(layout, 'app', 'resources', 'ai-component-pin.json')
    const pin = JSON.parse(readFileSync(pinPath, 'utf8'))
    pin.url = null
    writeFileSync(pinPath, `${JSON.stringify(pin, null, 2)}\n`)
    const bundledPython = path.join(layout, 'app', 'resources', 'ai-runtime', 'python', 'python.exe')
    if (existsSync(bundledPython)) {
      console.error('[package-msix] Refusing to publish a base Store package that contains the voice engine.')
      process.exit(1)
    }
    execFileSync(makeappx, ['pack', '/d', layout, '/p', packed, '/o', '/nv'], { stdio: 'inherit' })
    copyFileSync(packed, appxPath)
  } finally {
    rmSync(layout, { recursive: true, force: true })
    rmSync(packed, { force: true })
  }
  console.log('[package-msix] Store pin URL removed. Voice engine is not in this package.')
}

const build = spawnSync('npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})
if (build.status !== 0) process.exit(build.status ?? 1)

// Use node + electron-builder CLI directly (no shell) so values with spaces stay intact.
const pack = spawnSync(
  process.execPath,
  [electronBuilderCli, '--win', 'appx', '--x64', '--publish', 'never', ...configArgs],
  {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      // Allow local sideload testing without a Store/EV cert when none is configured.
      CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY || 'false',
    },
  },
)

if ((pack.status ?? 1) !== 0) process.exit(pack.status ?? 1)

const appxPath = path.join(root, outputDir, `SlipUpClipz-${publicVersion}.appx`)
stripStoreDownload(appxPath)
process.exit(0)
