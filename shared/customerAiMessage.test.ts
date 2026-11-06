import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { customerAiMessage } from './customerAiMessage.ts'

describe('AI customer messages', () => {
  it('hides the port and worker wording', () => {
    assert.match(
      customerAiMessage(
        'Another program is using the local AI port. SlipUpClipz will not send your recording there and will not stop that program.',
      ),
      /other SlipUpClipz window/,
    )
    assert.match(
      customerAiMessage('The AI engine stopped before it finished. Try again.'),
      /stopped before the voice was ready/,
    )
    assert.equal(customerAiMessage('Please enter the reference transcript and up to 500 characters of speech.'), 'Please enter the reference transcript and up to 500 characters of speech.')
  })

  it('removes the Electron IPC wrapper and explains a Windows memory failure', () => {
    const shown = customerAiMessage(
      "Error invoking remote method 'ai:generate': Error: The AI engine stopped before it finished. Try again.",
    )
    assert.match(shown, /stopped before the voice was ready/)
    assert.doesNotMatch(shown, /invoking remote method/i)
    assert.match(
      customerAiMessage('OSError: The paging file is too small for this operation to complete. (os error 1455)'),
      /will not change Windows virtual-memory settings/,
    )
  })
})