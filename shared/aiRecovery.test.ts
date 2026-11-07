import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { aiRecoveryAction } from './aiRecovery.ts'

describe('AI engine recovery', () => {
  it('offers a restart after a failed startup', () => {
    assert.equal(aiRecoveryAction('The AI engine took too long to start. Try again.'), 'restart-engine')
    assert.equal(aiRecoveryAction('The AI engine failed to start. Details are in the AI log next to the installed voice engine.'), 'restart-engine')
    assert.equal(
      aiRecoveryAction('The voice engine took too long to start. Try again when the computer is less busy.'),
      'restart-engine',
    )
  })

  it('offers a restart after a generation timeout, crash, or unresponsive worker', () => {
    assert.equal(aiRecoveryAction('AI Clone took too long to finish. Try again.'), 'restart-engine')
    assert.equal(aiRecoveryAction('AI Clone stopped before the voice was ready. Try again.'), 'restart-engine')
    assert.equal(aiRecoveryAction('The voice engine is still working. Try again in a moment.'), 'restart-engine')
  })

  it('offers a restart for memory and missing-model failures', () => {
    assert.equal(
      aiRecoveryAction('Windows ran out of memory while loading the voice model (error 1455). Close other programs and try again. SlipUpClipz will not change Windows virtual-memory settings.'),
      'restart-engine',
    )
    assert.equal(
      aiRecoveryAction('The GPU does not have enough free memory for AI Clone. Close other GPU programs and try again.'),
      'restart-engine',
    )
    assert.equal(aiRecoveryAction('The voice model files are not installed on this computer.'), 'restart-engine')
  })

  it('does not offer a restart for a port conflict, a cold start that is still running, or ordinary validation', () => {
    assert.equal(
      aiRecoveryAction('Another program is using the local AI port. SlipUpClipz will not send your recording there and will not stop that program.'),
      'none',
    )
    assert.equal(aiRecoveryAction('AI Clone is already in use. Close any other SlipUpClipz window, then try again.'), 'none')
    assert.equal(aiRecoveryAction('The voice engine is still starting. Try again in a moment.'), 'none')
    assert.equal(aiRecoveryAction('Check the speaker permission box before generating.'), 'none')
    assert.equal(aiRecoveryAction('Please enter the reference transcript and up to 500 characters of speech.'), 'none')
    assert.equal(aiRecoveryAction('AI Voice Cloning is a Pro feature.'), 'none')
    assert.equal(aiRecoveryAction('AI Clone generation was stopped.'), 'none')
  })
})
