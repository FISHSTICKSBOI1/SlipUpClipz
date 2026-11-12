import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], { cwd: root, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
console.log('[website:build] Exporting support knowledge…')
run('node_modules/tsx/dist/cli.mjs', ['scripts/export-support-knowledge.ts'])
console.log('[website:build] Typechecking…')
run('node_modules/typescript/bin/tsc', ['-p', 'website/tsconfig.json', '--noEmit'])
console.log('[website:build] Building static site…')
run('node_modules/vite/bin/vite.js', ['build', '--config', 'website/vite.config.ts'])
console.log('[website:build] Output: dist-website/')
