import { rmSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = path.join(root, 'release')

if (!existsSync(releaseDir)) {
  console.log('[release:clean] No release/ folder to remove.')
  process.exit(0)
}

rmSync(releaseDir, { recursive: true, force: true })
console.log('[release:clean] Removed previous release/ output.')
