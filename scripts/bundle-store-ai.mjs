#!/usr/bin/env node
/**
 * Puts the already verified portable runtime inside the Store package.
 * The website NSIS installer is left unchanged.
 *
 * This reads the small appx, hard-links the staged runtime into resources,
 * and writes a new appx. It does not upload the package or delete the archive.
 */
import { spawnSync } from 'node:child_process'
import { linkSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const makeappx = path.join(
  process.env.LOCALAPPDATA || '',
  'electron-builder',
  'Cache',
  'winCodeSign-2.6.0',
  'winCodeSign-2.6.0-5puky',
  'windows-10',
  'x64',
  'makeappx.exe',
)
const componentDir = process.env.SLIPUPCLIPZ_AI_COMPONENT || 'D:\\SlipUpClipzBuild\\ai-component'
const inputAppx = path.join(root, 'release-msix', 'SlipUpClipz-0.1.6.appx')
const layout = process.env.SLIPUPCLIPZ_APPX_LAYOUT || 'D:\\SlipUpClipzBuild\\appx-layout'
const outputAppx = process.env.SLIPUPCLIPZ_STORE_APPX || 'D:\\SlipUpClipzBuild\\SlipUpClipz-0.1.6.appx'

function hardlinkTree(source, destination) {
  mkdirSync(destination, { recursive: true })
  let files = 0
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name)
    const to = path.join(destination, entry.name)
    if (entry.isDirectory()) files += hardlinkTree(from, to)
    else {
      linkSync(from, to)
      files += 1
    }
  }
  return files
}

function runMakeAppx(args) {
  const result = spawnSync(makeappx, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`makeappx ${args[0]} failed with exit ${result.status}`)
  }
}

rmSync(layout, { recursive: true, force: true })
mkdirSync(path.dirname(outputAppx), { recursive: true })
rmSync(outputAppx, { force: true })

console.log('[bundle-store-ai] Unpacking', inputAppx)
runMakeAppx(['unpack', '/p', inputAppx, '/d', layout, '/o', '/nv'])

const runtimeDest = path.join(layout, 'app', 'resources', 'ai-runtime')
console.log('[bundle-store-ai] Linking runtime into', runtimeDest)
const linked = hardlinkTree(componentDir, runtimeDest)
console.log(`[bundle-store-ai] Linked ${linked} files`)

rmSync(path.join(layout, 'AppxBlockMap.xml'), { force: true })
rmSync(path.join(layout, 'AppxSignature.p7x'), { force: true })

console.log('[bundle-store-ai] Packing', outputAppx)
runMakeAppx(['pack', '/d', layout, '/p', outputAppx, '/o', '/nv'])
const size = statSync(outputAppx).size
console.log(`[bundle-store-ai] Wrote ${outputAppx} (${size} bytes)`)
if (size < 4_000_000_000) {
  throw new Error('The Store package is still too small to contain the voice engine.')
}
