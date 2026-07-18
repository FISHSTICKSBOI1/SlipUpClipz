import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getGmailComposeUrl } from './supportLinks'

describe('supportLinks', () => {
  it('builds a Gmail compose URL for direct support', () => {
    const url = getGmailComposeUrl('slipupclipz@gmail.com', 'SlipUpClipz Support')
    assert.equal(
      url,
      'https://mail.google.com/mail/?view=cm&fs=1&to=slipupclipz%40gmail.com&su=SlipUpClipz+Support',
    )
  })
})
