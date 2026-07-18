import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AiSupportAssistant } from '../components/AiSupportAssistant'
import { Button } from '../components/Button'
import { DirectEmailSupport } from '../components/DirectEmailSupport'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'
import {
  CONTACT_LIMITS,
  validateContactForm,
  type ContactFieldErrors,
  type ContactFormState,
} from '../lib/contactValidation'

const CATEGORIES = [
  'Installation',
  'Audio capture',
  'Clip trimming',
  'Soundboard',
  'Voice effects',
  'Discord/game routing',
  'License or Pro access',
  'Updates',
  'Bug report',
  'Feature suggestion',
  'Other',
] as const

type FormState = ContactFormState
type FieldErrors = ContactFieldErrors
type SubmitStatus = 'idle' | 'sending' | 'success' | 'error'

const INITIAL: FormState = {
  name: '',
  email: '',
  subject: '',
  category: CATEGORIES[0],
  message: '',
  appVersion: SITE.currentVersion,
  windowsVersion: '',
  diagnosticConsent: false,
}

function trimField(value: string) {
  return value.trim()
}

export function ContactPage() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [botField, setBotField] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [submitError, setSubmitError] = useState('')
  const statusRef = useRef<HTMLDivElement>(null)
  const submittingRef = useRef(false)

  const isSending = status === 'sending'
  const submitDisabled = isSending

  useEffect(() => {
    if (status === 'success' || status === 'error') {
      statusRef.current?.focus()
    }
  }, [status])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function submitForm() {
    if (submitDisabled || submittingRef.current) return

    const nextErrors = validateContactForm(form)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setStatus('idle')
      return
    }

    setErrors({})
    setSubmitError('')
    setStatus('sending')
    submittingRef.current = true

    try {
      const response = await fetch(SITE.contactSupportEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimField(form.name),
          email: trimField(form.email),
          subject: trimField(form.subject),
          category: form.category,
          message: trimField(form.message),
          appVersion: trimField(form.appVersion),
          windowsVersion: trimField(form.windowsVersion),
          diagnosticConsent: form.diagnosticConsent,
          botField,
        }),
      })

      let data: {
        success?: boolean
        sent?: boolean
        error?: string
        fieldErrors?: FieldErrors
      } = {}
      try {
        data = (await response.json()) as typeof data
      } catch {
        data = {}
      }

      const succeeded = response.ok && (data.success === true || data.sent === true)

      if (!succeeded) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors)
        }
        setSubmitError(
          response.status === 429
            ? data.error || 'Too many messages. Please wait a minute and try again.'
            : data.error || 'We could not send your message. Please try again.',
        )
        setStatus('error')
        return
      }

      setForm(INITIAL)
      setBotField('')
      setStatus('success')
    } catch {
      setSubmitError('Unable to reach the support service. Please try again.')
      setStatus('error')
    } finally {
      submittingRef.current = false
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submitForm()
  }

  return (
    <>
      <Seo
        title="Contact Support"
        description="Contact SlipUpClipz support about clipping, Discord routing, soundboard issues, updates, or licensing."
        path={SITE.paths.contact}
      />
      <section className="site-container py-14 sm:py-20">
        <SectionHeading
          eyebrow="Contact"
          title="Contact Support"
          description="Describe the problem and include your app and Windows versions. We typically reply by email."
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            className="panel space-y-5 p-6 sm:p-8"
            name={SITE.supportFormName}
            method="POST"
            onSubmit={onSubmit}
            noValidate
          >
            <p className="hidden" aria-hidden="true">
              <label>
                Do not fill this out:{' '}
                <input
                  name="bot-field"
                  tabIndex={-1}
                  autoComplete="off"
                  value={botField}
                  onChange={(e) => setBotField(e.target.value)}
                />
              </label>
            </p>

            <div className="rounded-xl border border-ink-border/80 bg-ink-raised/40 px-4 py-3 text-sm text-slate-300">
              <p>
                Support form messages are emailed to the SlipUpClipz team and used only to respond to
                your request.
              </p>
              <p className="mt-2">
                Please do not include passwords, payment information, or complete license keys.
              </p>
            </div>

            <div
              ref={statusRef}
              tabIndex={-1}
              aria-live="polite"
              aria-atomic="true"
              className="min-h-[1px]"
            >
              {status === 'success' ? (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
                >
                  Your message was sent. We&apos;ll respond at the email address you provided.
                </div>
              ) : null}
              {status === 'error' ? (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                >
                  <p>{submitError || 'We couldn’t send your message. Please try again.'}</p>
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="!px-3 !py-1.5 !text-xs"
                      onClick={() => void submitForm()}
                      disabled={isSending}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <Field label="Name" htmlFor="name" required error={errors.name}>
              <input
                id="name"
                name="name"
                required
                maxLength={CONTACT_LIMITS.nameMax}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="field"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'name-error' : undefined}
                disabled={isSending}
              />
            </Field>

            <Field label="Email" htmlFor="email" required error={errors.email} errorId="email-error">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="field"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                disabled={isSending}
              />
            </Field>

            <Field label="Subject" htmlFor="subject" required error={errors.subject} errorId="subject-error">
              <input
                id="subject"
                name="subject"
                required
                maxLength={CONTACT_LIMITS.subjectMax}
                value={form.subject}
                onChange={(e) => update('subject', e.target.value)}
                className="field"
                aria-invalid={Boolean(errors.subject)}
                aria-describedby={errors.subject ? 'subject-error' : undefined}
                disabled={isSending}
              />
            </Field>

            <Field
              label="Problem category"
              htmlFor="category"
              required
              error={errors.category}
              errorId="category-error"
            >
              <select
                id="category"
                name="category"
                required
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                className="field"
                aria-invalid={Boolean(errors.category)}
                aria-describedby={errors.category ? 'category-error' : undefined}
                disabled={isSending}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Message" htmlFor="message" required error={errors.message} errorId="message-error">
              <textarea
                id="message"
                name="message"
                required
                rows={6}
                maxLength={CONTACT_LIMITS.messageMax}
                value={form.message}
                onChange={(e) => update('message', e.target.value)}
                className="field resize-y"
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? 'message-error' : 'message-hint'}
                disabled={isSending}
              />
              <p id="message-hint" className="mt-2 text-xs text-slate-500">
                Up to {CONTACT_LIMITS.messageMax.toLocaleString()} characters.
              </p>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="App version"
                htmlFor="app-version"
                error={errors.appVersion}
                errorId="app-version-error"
              >
                <input
                  id="app-version"
                  name="app-version"
                  maxLength={CONTACT_LIMITS.appVersionMax}
                  value={form.appVersion}
                  onChange={(e) => update('appVersion', e.target.value)}
                  className="field"
                  aria-invalid={Boolean(errors.appVersion)}
                  aria-describedby={errors.appVersion ? 'app-version-error' : undefined}
                  disabled={isSending}
                />
              </Field>
              <Field
                label="Windows version"
                htmlFor="windows-version"
                error={errors.windowsVersion}
                errorId="windows-version-error"
              >
                <input
                  id="windows-version"
                  name="windows-version"
                  maxLength={CONTACT_LIMITS.windowsVersionMax}
                  placeholder="e.g. Windows 11 24H2"
                  value={form.windowsVersion}
                  onChange={(e) => update('windowsVersion', e.target.value)}
                  className="field"
                  aria-invalid={Boolean(errors.windowsVersion)}
                  aria-describedby={errors.windowsVersion ? 'windows-version-error' : undefined}
                  disabled={isSending}
                />
              </Field>
            </div>

            <div className="flex items-start gap-3">
              <input
                id="diagnostic-consent"
                name="diagnostic-consent"
                type="checkbox"
                checked={form.diagnosticConsent}
                onChange={(e) => update('diagnosticConsent', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-ink-border bg-ink-raised accent-glow-purple"
                disabled={isSending}
              />
              <label htmlFor="diagnostic-consent" className="text-sm text-slate-300">
                Optional: I may be contacted for follow-up diagnostic details if needed. No
                recordings or license keys are collected through this form.
              </label>
            </div>

            <div className="flex flex-col gap-4">
              <Button type="submit" className="w-full sm:w-auto" disabled={submitDisabled}>
                {isSending ? 'Sending…' : 'Send message'}
              </Button>
              <DirectEmailSupport compact />
            </div>
          </form>

          <div className="space-y-5">
            <AiSupportAssistant />
            <div className="panel p-5 text-sm text-slate-400">
              <h2 className="font-display text-lg font-semibold text-white">Before you write</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Check the Help Center for common audio and Discord fixes.</li>
                <li>Include whether Free or Pro is activated.</li>
                <li>Mention if the issue started after an update.</li>
                <li>File attachments are not supported on this form.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(42, 49, 72, 0.95);
          background: rgba(16, 19, 28, 0.9);
          padding: 0.7rem 0.85rem;
          color: #e8edf8;
          font-size: 0.875rem;
        }
        .field:focus {
          outline: 2px solid #7c5cff;
          outline-offset: 1px;
        }
        .field:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
      `}</style>
    </>
  )
}

function Field({
  label,
  htmlFor,
  required = false,
  error,
  errorId,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  errorId?: string
  children: ReactNode
}) {
  const messageId = errorId ?? (error ? `${htmlFor}-error` : undefined)

  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-slate-200">
        {label}
        {required ? <span className="text-slate-400"> (required)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={messageId} className="mt-2 text-xs text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
