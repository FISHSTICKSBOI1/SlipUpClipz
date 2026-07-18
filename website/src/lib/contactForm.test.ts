import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateContactForm } from './contactValidation'

describe('contact form validation', () => {
  it('requires name, email, subject, and message', () => {
    const errors = validateContactForm({
      name: '',
      email: 'not-an-email',
      subject: '',
      category: 'Other',
      message: '',
      appVersion: '0.1.4',
      windowsVersion: '',
      diagnosticConsent: false,
    })

    assert.equal(errors.name, 'Name is required.')
    assert.equal(errors.email, 'Enter a valid email address.')
    assert.equal(errors.subject, 'Subject is required.')
    assert.equal(errors.message, 'Message is required.')
  })

  it('accepts a complete valid form', () => {
    const errors = validateContactForm({
      name: 'Alex',
      email: 'alex@example.com',
      subject: 'Mic issue',
      category: 'Audio capture',
      message: 'The level meter is flat.',
      appVersion: '0.1.4',
      windowsVersion: 'Windows 11',
      diagnosticConsent: true,
    })

    assert.equal(Object.keys(errors).length, 0)
  })
})
