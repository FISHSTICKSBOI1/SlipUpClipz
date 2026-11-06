import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { claimAudioPlayback, subscribeAudioPlayback } from './audioPlayback'

describe('audio playback coordinator', () => {
  it('tells every other player when one sample starts', () => {
    const heard: string[] = []
    const stop = subscribeAudioPlayback((activeId) => heard.push(activeId))
    claimAudioPlayback('original')
    claimAudioPlayback('generated')
    stop()
    claimAudioPlayback('ignored')
    assert.deepEqual(heard, ['original', 'generated'])
  })
})