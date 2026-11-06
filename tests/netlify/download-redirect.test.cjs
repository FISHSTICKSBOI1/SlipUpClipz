const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

function redirectRules(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

describe('download redirect', () => {
  it('keeps the current setup executable and ignores blockmaps', async () => {
    const originalFetch = global.fetch
    global.fetch = async () => ({
      ok: true,
      async json() {
        return {
          assets: [
            {
              name: 'SlipUpClipz-Setup-0.1.5.exe.blockmap',
              browser_download_url: 'https://example.invalid/blockmap',
            },
            {
              name: 'SlipUpClipz-Setup-0.1.5.exe',
              browser_download_url:
                'https://github.com/FISHSTICKSBOI1/SlipUpClipz/releases/download/v0.1.5/SlipUpClipz-Setup-0.1.5.exe',
            },
          ],
        }
      },
    })
    try {
      const mod = await import('../../netlify/functions/download-latest.js')
      const result = await mod.handler()
      assert.equal(result.statusCode, 302)
      assert.equal(
        result.headers.Location,
        'https://github.com/FISHSTICKSBOI1/SlipUpClipz/releases/download/v0.1.5/SlipUpClipz-Setup-0.1.5.exe',
      )
    } finally {
      global.fetch = originalFetch
    }
  })

  it('sends /download/latest to the installer function before the SPA catch-all', () => {
    const rules = redirectRules(readFileSync(join(__dirname, '../../website/public/_redirects'), 'utf8'))
    const downloadIndex = rules.findIndex((line) => line.startsWith('/download/latest'))
    const spaIndex = rules.findIndex((line) => line.startsWith('/*'))
    assert.ok(downloadIndex >= 0)
    assert.ok(spaIndex > downloadIndex)
    assert.match(rules[downloadIndex], /\/\.netlify\/functions\/download-latest/)
    assert.match(rules[downloadIndex], /302!/)
  })
})
