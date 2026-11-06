import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { visibleShorts } from './shorts'

describe('visibleShorts', () => {
  it('hides cards until a YouTube id is configured', () => {
    assert.deepEqual(
      visibleShorts([
        { youtubeId: '', title: 'One' },
        { youtubeId: '   ', title: 'Two' },
      ]),
      [],
    )
  })

  it('keeps only configured shorts', () => {
    assert.deepEqual(
      visibleShorts([
        { youtubeId: '', title: 'Hidden' },
        { youtubeId: 'configured-id', title: 'Shown' },
      ]),
      [{ youtubeId: 'configured-id', title: 'Shown' }],
    )
  })
})