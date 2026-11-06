#!/usr/bin/env node
/**
 * Structural verification for the Microsoft Store AppX package.
 * Does not require Developer Mode; validates the built .appx contents.
 */
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

function fail(message) {
  console.error(`[verify:msix] ${message}`)
  process.exit(1)
}

const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
const appxPath = path.join(root, 'release-msix', `SlipUpClipz-${version}.appx`)
if (!existsSync(appxPath)) {
  fail(`Missing ${appxPath}. Run npm run package:msix first.`)
}

const cacheRoot = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache')
function findMakeAppx() {
  const { readdirSync, statSync } = require('node:fs')
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

const makeappx = findMakeAppx()
if (!makeappx) fail('makeappx.exe not found in electron-builder cache')

const unpackDir = mkdtempSync(path.join(tmpdir(), 'slipupclipz-appx-'))
try {
  execFileSync(makeappx, ['unpack', '/p', appxPath, '/d', unpackDir, '/o'], { stdio: 'pipe' })
  const manifestPath = path.join(unpackDir, 'AppxManifest.xml')
  const exePath = path.join(unpackDir, 'app', 'SlipUpClipz.exe')
  if (!existsSync(manifestPath)) fail('AppxManifest.xml missing inside package')
  if (!existsSync(exePath)) fail('app/SlipUpClipz.exe missing inside package')

  const manifest = readFileSync(manifestPath, 'utf8')
  for (const required of [
    'Name="SlipUpClipzLLC.SlipUpClipz"',
    "Publisher='CN=3B960933-E78C-4110-B2BE-9718E5AB5729'",
    'PublisherDisplayName>SlipUpClipz LLC</PublisherDisplayName>',
    'Id="SlipUpClipz"',
    'runFullTrust',
    'internetClient',
    'microphone',
  ]) {
    if (!manifest.includes(required)) fail(`Manifest missing expected value: ${required}`)
  }

  const archMatch = manifest.match(/ProcessorArchitecture="([^"]+)"/)
  const versionMatch = manifest.match(/\bVersion="([^"]+)"/)
  if (versionMatch?.[1] !== '1.0.6.0') {
    fail(`Expected AppX Identity Version 1.0.6.0, found ${versionMatch?.[1] || 'missing'}`)
  }
  if (archMatch?.[1] !== 'x64') {
    fail(`Expected architecture x64, found ${archMatch?.[1] || 'missing'}`)
  }

  const publicVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
  if (publicVersion !== '0.1.6') {
    fail(`Expected public package.json version 0.1.6, found ${publicVersion}`)
  }

  const { missingAiAppModulesFromDir } = require('../shared/aiAppResources.cjs')
  const resourcesRoot = path.join(unpackDir, 'app', 'resources')
  const missingAi = missingAiAppModulesFromDir(existsSync, path.join, resourcesRoot)
  if (missingAi.length) {
    fail(`app/resources/ai-app missing required modules: ${missingAi.join(', ')}`)
  }
  const bundledPython = path.join(unpackDir, 'app', 'resources', 'ai-runtime', 'python', 'python.exe')
  const pinPath = path.join(unpackDir, 'app', 'resources', 'ai-component-pin.json')
  if (existsSync(bundledPython)) {
    fail('The base Store package contains python.exe. Free customers would have to download the voice engine.')
  }
  const pin = JSON.parse(readFileSync(pinPath, 'utf8'))
  if (pin.url != null) {
    fail('The Store package pin includes a download URL. Store builds must not download the executable archive.')
  }
  if (pin.model !== 'Qwen/Qwen3-TTS-12Hz-0.6B-Base') {
    fail(`Unexpected model pin: ${pin.model}`)
  }

  console.log('[verify:msix] OK')
  console.log(`  package : ${appxPath}`)
  console.log(`  size    : ${(require('node:fs').statSync(appxPath).size / (1024 * 1024)).toFixed(1)} MB`)
  console.log(`  identity: SlipUpClipzLLC.SlipUpClipz`)
  console.log(`  publisher: CN=3B960933-E78C-4110-B2BE-9718E5AB5729`)
  console.log(`  publisherDisplayName: SlipUpClipz LLC`)
  console.log(`  version : ${versionMatch[1]}`)
  console.log(`  arch    : ${archMatch[1]}`)
  console.log(`  public package.json version (unchanged): ${publicVersion}`)
  console.log('  exe     : app/SlipUpClipz.exe present')
  console.log('  ai app  : required Python modules present, voice-engine python.exe absent')
  console.log('  pin url : null')
  console.log('  note    : file inspection does not prove AI generation or a Store upgrade')
} finally {
  rmSync(unpackDir, { recursive: true, force: true })
}
