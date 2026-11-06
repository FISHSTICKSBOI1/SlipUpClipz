import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import {
  backupProfileStore,
  legacyUserDataPath,
  PROFILE_STORE_FILE,
  restoreProfileSnapshot,
  snapshotCompleteProfile,
  snapshotManifestContains,
} from './profileBackup.js'

const root = mkdtempSync(path.join(tmpdir(), 'slipup-profile-'))

after(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('v0.1.5 profile upgrade', () => {
  it('keeps the published AppData folder name', () => {
    assert.equal(legacyUserDataPath('C:\\Users\\customer\\AppData\\Roaming'), path.join('C:\\Users\\customer\\AppData\\Roaming', 'slipupclipz'))
  })

  it('backs up an existing profile without changing the license or settings', () => {
    const userData = path.join(root, 'slipupclipz')
    mkdirSync(userData, { recursive: true })
    const source = path.join(userData, PROFILE_STORE_FILE)
    const original = {
      settings: {
        launchOnStartup: true,
        minimizeToTray: false,
        hearMyself: false,
        clipHotkey: 'Ctrl+Shift+R',
        stopAllHotkey: 'Ctrl+Shift+Z',
        audioOutputDeviceId: 'speakers-1',
        voicePreset: 'radio',
      },
      license: {
        activated: true,
        tier: 'pro',
        key: 'SLIP-TEST-KEEP-0001',
        activatedAt: Date.parse('2026-11-01T00:00:00.000Z'),
        expiresAt: '2027-11-01T00:00:00.000Z',
        lastValidatedAt: Date.parse('2026-11-02T00:00:00.000Z'),
      },
    }
    writeFileSync(source, JSON.stringify(original), { encoding: 'utf8' })
    const before = readFileSync(source)

    const first = backupProfileStore(userData)
    const second = backupProfileStore(userData)
    assert.equal(first.ok, true)
    assert.equal(first.skipped, false)
    assert.equal(second.ok, true)
    assert.equal(second.skipped, true)
    assert.equal(first.backupPath, second.backupPath)
    assert.equal(readFileSync(source).equals(before), true)

    const restored = JSON.parse(readFileSync(first.backupPath ?? '', 'utf8'))
    assert.equal(restored.license.key, original.license.key)
    assert.equal(restored.license.expiresAt, original.license.expiresAt)
    assert.equal(restored.settings.clipHotkey, 'Ctrl+Shift+R')
    assert.equal(restored.settings.hearMyself, false)
  })

  it('leaves a missing profile alone', () => {
    const empty = path.join(root, 'empty')
    const result = backupProfileStore(empty)
    assert.deepEqual(result, { ok: true, skipped: true })
  })
})

describe('complete profile snapshot', () => {
  const licenseKey = 'SLIP-TEST-KEEP-0001'

  function writeProfile(userData: string, audio: string) {
    mkdirSync(path.join(userData, 'IndexedDB', 'file__0.indexeddb.leveldb'), { recursive: true })
    mkdirSync(path.join(userData, 'Local Storage', 'leveldb'), { recursive: true })
    writeFileSync(path.join(userData, 'IndexedDB', 'file__0.indexeddb.leveldb', 'audio.bin'), audio)
    writeFileSync(
      path.join(userData, 'Local Storage', 'leveldb', '000001.log'),
      JSON.stringify({
        'slipupclipz-clip-library': [{ id: 'clip-hello', name: 'Hello there', hotkey: 'Ctrl+Shift+1' }],
        'slipupclipz-soundboard': [{ clipId: 'clip-hello', volume: 80 }],
      }),
    )
    writeFileSync(
      path.join(userData, PROFILE_STORE_FILE),
      JSON.stringify({
        settings: { hearMyself: false, clipHotkey: 'Ctrl+Shift+R' },
        license: { activated: true, tier: 'pro', key: licenseKey, expiresAt: '2027-11-01T00:00:00.000Z' },
      }),
    )
  }

  it('copies audio, clip metadata, and settings without putting the license key in the manifest', () => {
    const userData = path.join(root, 'full')
    writeProfile(userData, 'hello-audio')
    const audioPath = path.join(userData, 'IndexedDB', 'file__0.indexeddb.leveldb', 'audio.bin')
    const before = readFileSync(audioPath)

    const first = snapshotCompleteProfile(userData)
    const second = snapshotCompleteProfile(userData)
    assert.equal(first.ok, true)
    assert.equal(first.skipped, false)
    assert.equal(second.ok, true)
    assert.equal(second.skipped, true)
    assert.equal(readFileSync(audioPath).equals(before), true)
    assert.equal(snapshotManifestContains(first.backupPath ?? '', licenseKey), false)
    assert.equal(
      readFileSync(path.join(first.backupPath ?? '', 'IndexedDB', 'file__0.indexeddb.leveldb', 'audio.bin'), 'utf8'),
      'hello-audio',
    )
  })

  it('restores audio and the saved license after the live files are emptied', () => {
    const userData = path.join(root, 'restore')
    writeProfile(userData, 'keep-this-audio')
    const snap = snapshotCompleteProfile(userData)
    assert.equal(snap.ok, true)

    writeFileSync(path.join(userData, 'IndexedDB', 'file__0.indexeddb.leveldb', 'audio.bin'), 'erased')
    writeFileSync(path.join(userData, PROFILE_STORE_FILE), JSON.stringify({ license: { activated: false, tier: 'free' } }))

    const restored = restoreProfileSnapshot(snap.backupPath ?? '', userData)
    assert.equal(restored.ok, true)
    assert.equal(
      readFileSync(path.join(userData, 'IndexedDB', 'file__0.indexeddb.leveldb', 'audio.bin'), 'utf8'),
      'keep-this-audio',
    )
    const license = JSON.parse(readFileSync(path.join(userData, PROFILE_STORE_FILE), 'utf8')).license
    assert.equal(license.key, licenseKey)
    assert.equal(license.expiresAt, '2027-11-01T00:00:00.000Z')
    assert.equal(existsSync(path.join(snap.backupPath ?? '', 'COMPLETE')), true)
  })

  it('does not restore an unfinished snapshot', () => {
    const userData = path.join(root, 'partial')
    mkdirSync(userData, { recursive: true })
    const result = restoreProfileSnapshot(path.join(userData, 'missing'), userData)
    assert.equal(result.ok, false)
  })
})

