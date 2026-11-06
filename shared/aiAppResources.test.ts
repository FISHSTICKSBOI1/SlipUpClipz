import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { createRequire } from 'node:module'
import {
  extraResourceDestination,
  missingAiAppModules,
  packagedAiAppPath,
  REQUIRED_AI_APP_MODULES,
} from './aiAppResources.ts'

const cjs = createRequire(import.meta.url)('./aiAppResources.cjs') as {
  missingAiAppModulesFromDir: (
    existsSync: (path: string) => boolean,
    join: (...parts: string[]) => string,
    resourcesRoot: string,
  ) => string[]
}

describe('packaged AI Python resources', () => {
  it('requires every worker module in extraResources', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      build?: { extraResources?: Array<{ from?: string; to?: string }> }
    }
    const destinations = (pkg.build?.extraResources ?? []).map(extraResourceDestination)
    assert.deepEqual(missingAiAppModules(destinations), [])
    for (const name of REQUIRED_AI_APP_MODULES) {
      assert.equal(destinations.includes(`ai-app/${name}`), true)
    }
  })

  it('fails when a required module is missing from extraResources', () => {
    const destinations = [
      'ai-app/server.py',
      'ai-app/generation_guard.py',
      'ai-app/reference_audio.py',
    ]
    assert.deepEqual(missingAiAppModules(destinations), ['server_temp_outputs.py'])
    assert.equal(packagedAiAppPath('C:/app/resources', 'server_temp_outputs.py'), 'C:/app/resources/ai-app/server_temp_outputs.py')
    const present = new Set([
      'app/resources/ai-app/server.py',
      'app/resources/ai-app/generation_guard.py',
      'app/resources/ai-app/reference_audio.py',
    ])
    const missing = cjs.missingAiAppModulesFromDir(
      (filePath) => present.has(filePath.replace(/\\/g, '/')),
      (...parts) => parts.join('/'),
      'app/resources',
    )
    assert.deepEqual(missing, ['server_temp_outputs.py'])
  })

  it('keeps overlay extraResources aligned with the worker modules', () => {
    const overlay = JSON.parse(
      readFileSync(new URL('../build/msix-overlay.json', import.meta.url), 'utf8'),
    ) as { extraResources?: Array<{ from?: string; to?: string }> }
    const destinations = (overlay.extraResources ?? []).map(extraResourceDestination)
    assert.deepEqual(missingAiAppModules(destinations), [])
    const packager = readFileSync(new URL('../scripts/package-msix.mjs', import.meta.url), 'utf8')
    assert.equal(packager.includes('msix-overlay'), false)
  })
})
