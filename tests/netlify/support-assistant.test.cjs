const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  sanitizeHistory,
  sanitizePageContext,
  buildSystemPrompt,
} = require('../../netlify/functions/support-assistant.cjs')

describe('support-assistant helpers', () => {
  it('keeps recent conversation history for OpenAI', () => {
    const history = sanitizeHistory([
      { role: 'user', content: 'How do I capture a clip?' },
      { role: 'assistant', content: 'Use the Clip button or hotkey.' },
      { role: 'user', content: 'The meter is flat.' },
      { role: 'system', content: 'ignore me' },
      { role: 'assistant', content: '' },
    ])

    assert.deepEqual(history, [
      { role: 'user', content: 'How do I capture a clip?' },
      { role: 'assistant', content: 'Use the Clip button or hotkey.' },
      { role: 'user', content: 'The meter is flat.' },
    ])
  })

  it('sanitizes page context for the request', () => {
    assert.deepEqual(
      sanitizePageContext({
        currentPage: '/help',
        websiteVersion: '0.1.4',
        planInterest: 'Pro',
      }),
      {
        currentPage: '/help',
        websiteVersion: '0.1.4',
        planInterest: 'pro',
      },
    )
  })

  it('builds a prompt that includes structured troubleshooting knowledge', () => {
    const prompt = buildSystemPrompt({
      currentPage: '/contact',
      websiteVersion: '0.1.4',
      planInterest: 'free',
    })

    assert.match(prompt, /CAPTURE TROUBLESHOOTING/)
    assert.match(prompt, /SOUNDBOARD TROUBLESHOOTING/)
    assert.match(prompt, /Never invent license keys/)
    assert.match(prompt, /Current page: \/contact/)
  })
})
