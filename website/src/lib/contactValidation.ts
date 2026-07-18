export const CONTACT_LIMITS = {
  nameMin: 1,
  nameMax: 100,
  subjectMin: 1,
  subjectMax: 200,
  messageMin: 1,
  messageMax: 5000,
  appVersionMax: 50,
  windowsVersionMax: 100,
} as const

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ContactFormState = {
  name: string
  email: string
  subject: string
  category: string
  message: string
  appVersion: string
  windowsVersion: string
  diagnosticConsent: boolean
}

export type ContactFieldErrors = Partial<Record<keyof ContactFormState, string>>

function trimField(value: string) {
  return value.trim()
}

export function validateContactForm(form: ContactFormState): ContactFieldErrors {
  const errors: ContactFieldErrors = {}

  const name = trimField(form.name)
  if (name.length < CONTACT_LIMITS.nameMin) errors.name = 'Name is required.'
  else if (name.length > CONTACT_LIMITS.nameMax) {
    errors.name = `Name must be ${CONTACT_LIMITS.nameMax} characters or fewer.`
  }

  const email = trimField(form.email)
  if (!email) errors.email = 'Email is required.'
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.'

  const subject = trimField(form.subject)
  if (subject.length < CONTACT_LIMITS.subjectMin) errors.subject = 'Subject is required.'
  else if (subject.length > CONTACT_LIMITS.subjectMax) {
    errors.subject = `Subject must be ${CONTACT_LIMITS.subjectMax} characters or fewer.`
  }

  if (!form.category) errors.category = 'Choose a problem category.'

  const message = trimField(form.message)
  if (message.length < CONTACT_LIMITS.messageMin) errors.message = 'Message is required.'
  else if (message.length > CONTACT_LIMITS.messageMax) {
    errors.message = `Message must be ${CONTACT_LIMITS.messageMax} characters or fewer.`
  }

  if (form.appVersion.length > CONTACT_LIMITS.appVersionMax) {
    errors.appVersion = `App version must be ${CONTACT_LIMITS.appVersionMax} characters or fewer.`
  }

  if (form.windowsVersion.length > CONTACT_LIMITS.windowsVersionMax) {
    errors.windowsVersion = `Windows version must be ${CONTACT_LIMITS.windowsVersionMax} characters or fewer.`
  }

  return errors
}
