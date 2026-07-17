import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const viteConfig = path.join(root, 'website', 'vite.config.ts')
const tsconfig = path.join(root, 'website', 'tsconfig.json')

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

console.log('[website:build] Exporting support knowledge…')
run('npx', ['tsx', path.join(root, 'scripts', 'export-support-knowledge.ts')])

console.log('[website:build] Typechecking…')
run('npx', ['tsc', '-p', tsconfig, '--noEmit'])

console.log('[website:build] Building static site…')
run('npx', ['vite', 'build', '--config', viteConfig])

console.log('[website:build] Output: dist-website/')
