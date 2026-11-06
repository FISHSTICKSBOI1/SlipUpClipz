import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('soundboard and clips layout', () => {
  it('restores the original Soundboard order and drops the extra setup panels', () => {
    const page = source('src/pages/SoundboardPage.tsx')
    const output = page.indexOf('<SoundboardOutputStrip />')
    const mixer = page.indexOf('<SoundboardMixerControls />')
    const effects = page.indexOf('<VoiceEffectsControls />')
    const categories = page.indexOf('>Categories<')
    const pads = page.indexOf('>Pad grid<')
    const grid = page.indexOf('<SoundboardGrid')
    assert.ok(output > 0 && mixer > output && effects > mixer && categories > effects && pads > categories && grid > pads)
    assert.equal(page.includes('max-w-5xl'), false)
    assert.equal(page.includes('Voice Chat Setup'), false)
    assert.equal(page.includes('Advanced audio settings'), false)
    assert.equal(page.includes('SoundboardQuickBar'), false)
    assert.equal(page.includes('GamingDiscordPanel'), false)
    assert.equal(page.includes('aria-label="Volume"'), false)
    const settings = source('src/pages/SettingsPage.tsx')
    assert.equal(settings.includes('VoiceChatSetupSection'), false)
    const clips = source('src/components/clips/RecorderPanel.tsx')
    assert.equal(clips.includes('HearMyselfButton'), false)
  })

  it('maps Hear Myself and the mixer microphone to the saved routing settings', () => {
    const strip = source('src/components/soundboard/SoundboardOutputStrip.tsx')
    const mixer = source('src/components/soundboard/SoundboardMixerControls.tsx')
    assert.equal(strip.includes('device-select'), true)
    assert.equal(strip.includes('Hear myself'), true)
    assert.match(source('src/index.css'), /select\.device-select option[\s\S]*color:\s*#1a1428/)
    assert.equal(strip.includes('monitorMicrophoneLocally'), true)
    assert.equal(strip.includes('hearMyself'), false)
    assert.equal(mixer.includes('Live audio mixer'), true)
    assert.equal(mixer.includes('Mic volume'), true)
    assert.equal(mixer.includes('Soundboard volume'), true)
    assert.equal(mixer.includes('gamingDiscordPreset'), true)
    assert.equal(mixer.includes('mixerMicrophoneEnabled'), true)
    assert.equal(source('src/components/AppLayout.tsx').includes('<RightPanel />'), true)
  })
})