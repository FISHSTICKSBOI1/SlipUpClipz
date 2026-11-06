import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildBugReport, redactSensitiveText } from './bugReport.ts'

describe('bug report text', () => {
  it('removes license keys and personal paths before the contact form', () => {
    const cleaned = redactSensitiveText(
      'Key SLIP-AB12-CD34-EF56 failed at C:\\Users\\Alex\\AppData\\slipupclipz\\clip.wav',
    )
    assert.equal(cleaned.includes('SLIP-'), false)
    assert.equal(cleaned.includes('Alex'), false)
    assert.match(cleaned, /license key removed/)
    assert.match(cleaned, /path removed/)
  })

  it('includes the version and leaves diagnostics out until requested', () => {
    const plain = buildBugReport({
      description: 'The pad did not play.',
      version: '0.1.6',
      includeDiagnostics: false,
    })
    assert.match(plain, /App version: 0.1.6/)
    assert.equal(plain.includes('Plan:'), false)
    assert.match(plain, /No recording/)

    const detailed = buildBugReport({
      description: 'Install button stayed visible.',
      version: '0.1.6',
      includeDiagnostics: true,
      platform: 'win32',
      plan: 'Pro',
      voiceCloning: 'ready',
    })
    assert.match(detailed, /Plan: Pro/)
    assert.match(detailed, /Voice Cloning: ready/)
    assert.equal(detailed.includes('SLIP-'), false)
  })
})
