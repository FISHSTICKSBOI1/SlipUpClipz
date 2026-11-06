import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { loadCategories, saveCategories } from './categoryStorage.js'
import { clipLibraryLoadError, loadClips, saveClips } from './clipStorage.js'
import { loadSoundboardState, saveSoundboardState, soundboardLoadError } from './soundboardStorage.js'

const memory = new Map<string, string>()

const storage = {
  getItem(key: string) {
    return memory.has(key) ? memory.get(key)! : null
  },
  setItem(key: string, value: string) {
    memory.set(key, value)
  },
  removeItem(key: string) {
    memory.delete(key)
  },
  clear() {
    memory.clear()
  },
  key() {
    return null
  },
  get length() {
    return memory.size
  },
}

Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })

beforeEach(() => {
  memory.clear()
})

describe('saved library survives a bad read', { concurrency: 1 }, () => {
  it('does not replace a corrupt clip library with an empty one', () => {
    memory.set('slipupclipz-clip-library', '{')
    assert.equal(loadClips().length, 0)
    assert.equal(clipLibraryLoadError()?.includes('left on this PC'), true)
    saveClips([])
    assert.equal(memory.get('slipupclipz-clip-library'), '{')
  })

  it('keeps v0.1.5 clips, hotkeys, and categories', () => {
    const clips = [
      {
        id: 'clip-hello',
        name: 'Hello there',
        hotkey: 'Ctrl+Shift+1',
        hasAudio: true,
        createdAt: 1,
      },
    ]
    memory.set('slipupclipz-clip-library', JSON.stringify(clips))
    memory.set(
      'slipupclipz-categories',
      JSON.stringify([{ id: 'cat-1', name: 'Games', createdAt: 1 }]),
    )
    assert.equal(loadClips()[0]?.hotkey, 'Ctrl+Shift+1')
    assert.equal(loadCategories()[0]?.name, 'Games')
    saveClips(loadClips())
    assert.equal(JSON.parse(memory.get('slipupclipz-clip-library') ?? '[]')[0].name, 'Hello there')
  })

  it('does not replace a corrupt soundboard', () => {
    memory.set('slipupclipz-soundboard', 'not-json')
    const loaded = loadSoundboardState()
    assert.equal(loaded.pads.every((pad) => pad.clipId === null), true)
    assert.ok(soundboardLoadError())
    saveSoundboardState(loaded)
    assert.equal(memory.get('slipupclipz-soundboard'), 'not-json')
  })

  it('keeps existing pad assignments when reading the v0.1.5 soundboard', () => {
    memory.set(
      'slipupclipz-soundboard',
      JSON.stringify({
        version: 3,
        pads: [
          { clipId: 'clip-hello', volume: 80 },
          { clipId: null, volume: 100 },
        ],
      }),
    )
    const loaded = loadSoundboardState()
    assert.equal(loaded.pads[0]?.clipId, 'clip-hello')
    assert.equal(loaded.pads[0]?.volume, 80)
    assert.equal(loaded.pads.length, 50)
    saveSoundboardState(loaded)
    const saved = JSON.parse(memory.get('slipupclipz-soundboard') ?? '{}')
    assert.equal(saved.pads[0].clipId, 'clip-hello')
    assert.equal(saved.pads[0].volume, 80)
  })

  it('does not replace corrupt categories', () => {
    memory.set('slipupclipz-categories', '{')
    assert.equal(loadCategories().length, 0)
    saveCategories([])
    assert.equal(memory.get('slipupclipz-categories'), '{')
  })
})
