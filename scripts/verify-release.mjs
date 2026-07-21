import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = path.join(root, 'release')
const packageJsonPath = path.join(root, 'package.json')
const latestYmlPath = path.join(releaseDir, 'latest.yml')
const asarPath = path.join(releaseDir, 'win-unpacked', 'resources', 'app.asar')

function fail(message) {
  console.error(`[verify:release] ${message}`)
  process.exit(1)
}

function readPackageVersion() {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  if (!pkg.version || typeof pkg.version !== 'string') {
    fail('package.json is missing a version field.')
  }
  return pkg.version
}

function parseLatestYml(raw) {
  const versionMatch = raw.match(/^version:\s*(.+)\s*$/m)
  const pathMatch = raw.match(/^path:\s*(.+)\s*$/m)
  const urlMatch = raw.match(/^\s+-\s+url:\s*(.+)\s*$/m)

  if (!versionMatch) fail('latest.yml is missing a version field.')
  if (!pathMatch) fail('latest.yml is missing a path field.')

  return {
    version: versionMatch[1].trim().replace(/^['"]|['"]$/g, ''),
    path: pathMatch[1].trim().replace(/^['"]|['"]$/g, ''),
    url: urlMatch ? urlMatch[1].trim().replace(/^['"]|['"]$/g, '') : null,
  }
}

function findAsarCli() {
  const candidates = [
    path.join(root, 'node_modules', '@electron', 'asar', 'bin', 'asar.js'),
    path.join(root, 'node_modules', 'asar', 'bin', 'asar.js'),
    path.join(root, 'node_modules', 'app-builder-lib', 'node_modules', '@electron', 'asar', 'bin', 'asar.js'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function verifyPackagedLicenseValidation() {
  if (!existsSync(asarPath)) {
    fail('Missing release/win-unpacked/resources/app.asar')
  }

  const asarCli = findAsarCli()
  if (!asarCli) {
    fail('Could not find @electron/asar CLI to inspect packaged main.js')
  }

  const extractDir = mkdtempSync(path.join(tmpdir(), 'slipupclipz-verify-asar-'))
  const extractedMain = path.join(extractDir, 'main.js')
  try {
    execFileSync(
      process.execPath,
      [asarCli, 'extract-file', asarPath, 'dist-electron/main.js', extractedMain],
      { stdio: 'pipe' },
    )

    const mainJs = readFileSync(extractedMain, 'utf8')
    const productionUrl = 'https://slipupclipz.com/.netlify/functions/validate-license'

    if (!mainJs.includes(productionUrl)) {
      fail(`Packaged main.js is missing production validate-license URL: ${productionUrl}`)
    }

    if (!/license:activate/.test(mainJs)) {
      fail('Packaged main.js is missing license:activate handler.')
    }

    // Old checksum-only builds activated via local SHA256 secret without the production URL.
    if (mainJs.includes('slipupclipz-license-v1') && !mainJs.includes('validateLicenseWithServer') && !mainJs.includes(productionUrl)) {
      fail('Packaged app still appears to use checksum-only license activation.')
    }

    console.log('[verify:release] Packaged license validation OK')
    console.log('  production URL present : yes')
    console.log(`  asar                   : ${asarPath}`)
  } finally {
    rmSync(extractDir, { recursive: true, force: true })
  }
}

const version = readPackageVersion()
const localInstallerName = `SlipUpClipz Setup ${version}.exe`
const localBlockmapName = `${localInstallerName}.blockmap`
// electron-builder uploads to GitHub with spaces replaced by dashes, and writes
// that safe name into latest.yml. Both must stay in sync.
const publishedInstallerName = localInstallerName.replace(/ /g, '-')
const publishedBlockmapName = `${publishedInstallerName}.blockmap`

const localInstallerPath = path.join(releaseDir, localInstallerName)
const localBlockmapPath = path.join(releaseDir, localBlockmapName)

if (!existsSync(releaseDir)) {
  fail('release/ folder is missing. Run npm run package first.')
}

if (!existsSync(latestYmlPath)) {
  fail('release/latest.yml is missing. Packaging did not generate update metadata.')
}

if (!existsSync(localInstallerPath)) {
  fail(`Missing installer: release/${localInstallerName}`)
}

if (!existsSync(localBlockmapPath)) {
  fail(`Missing blockmap: release/${localBlockmapName}`)
}

const latest = parseLatestYml(readFileSync(latestYmlPath, 'utf8'))

if (latest.version !== version) {
  fail(
    `Version mismatch: package.json is ${version} but latest.yml is ${latest.version}.`,
  )
}

if (latest.path !== publishedInstallerName) {
  fail(
    `latest.yml path "${latest.path}" does not match expected published name "${publishedInstallerName}".`,
  )
}

if (latest.url && latest.url !== publishedInstallerName) {
  fail(
    `latest.yml files[0].url "${latest.url}" does not match expected published name "${publishedInstallerName}".`,
  )
}

verifyPackagedLicenseValidation()

console.log('[verify:release] OK')
console.log(`  package.json version : ${version}`)
console.log(`  latest.yml version   : ${latest.version}`)
console.log(`  local installer      : ${localInstallerName}`)
console.log(`  local blockmap       : ${localBlockmapName}`)
console.log(`  published installer  : ${publishedInstallerName}`)
console.log(`  published blockmap   : ${publishedBlockmapName}`)
console.log(`  latest.yml path      : ${latest.path}`)
