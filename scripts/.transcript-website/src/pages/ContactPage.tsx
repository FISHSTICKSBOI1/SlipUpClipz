import { useState, type FormEvent, type ReactNode } from 'react'
import { AiSupportPlaceholder } from '../components/AiSupportPlaceholder'
import { Button } from '../components/Button'
import { SectionHeading } from '../components/SectionHeading'
import { Seo } from '../components/Seo'
import { SITE } from '../config/site'

const CATEGORIES = [
  'Getting started',
  'Clipping',
  'Soundboard',
  'Discord / routing',
  'Voice effects',
  'Updates / licensing',
  'Other',
] as const

type FormState = {
  name: string
  email: string
  subject: string
  category: string
  message: string
  appVersion: string
  windowsVersion: string
}

const INITIAL: FormState = {
  name: '',
  email: '',
  subject: '',
  category: CATEGORIES[0],
  message: '',
  appVersion: SITE.currentVersion,
  windowsVersion: '',
}

export function ContactPage() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [mode] = useState<'mailto' | 'coming-soon'>('mailto')

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (mode !== 'mailto') {
      return
    }

    const body = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Category: ${form.category}`,
      `App version: ${form.appVersion}`,
      `Windows version: ${form.windowsVersion}`,
      '',
      form.message,
    ].join('\n')

    const mailto = `mailto:${SITE.supportEmail}?subject=${encodeURIComponent(
      form.subject || 'SlipUpClipz support',
    )}&body=${encodeURIComponent(body)}`

    window.location.href = mailto
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
          description="Describe the problem and include your app and Windows versions. There is no backend yet — submitting opens your email client."
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <form className="panel space-y-5 p-6 sm:p-8" onSubmit={onSubmit} noValidate>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Support form backend is not connected yet. Submitting opens a mailto draft to{' '}
              <strong>{SITE.supportEmail}</strong>. Replace this with a real ticket API later.
            </div>

            <Field label="Name" htmlFor="name">
              <input
                id="name"
                name="name"
                required
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="field"
              />
            </Field>

            <Field label="Email" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="field"
              />
            </Field>

            <Field label="Subject" htmlFor="subject">
              <input
                id="subject"
                name="subject"
                required
                value={form.subject}
                onChange={(e) => update('subject', e.target.value)}
                className="field"
              />
            </Field>

            <Field label="Problem category" htmlFor="category">
              <select
                id="category"
                name="category"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                className="field"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Message" htmlFor="message">
              <textarea
                id="message"
                name="message"
                required
                rows={6}
                value={form.message}
                onChange={(e) => update('message', e.target.value)}
                className="field resize-y"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="App version" htmlFor="appVersion">
                <input
                  id="appVersion"
                  name="appVersion"
                  value={form.appVersion}
                  onChange={(e) => update('appVersion', e.target.value)}
                  className="field"
                />
              </Field>
              <Field label="Windows version" htmlFor="windowsVersion">
                <input
                  id="windowsVersion"
                  name="windowsVersion"
                  placeholder="e.g. Windows 11 24H2"
                  value={form.windowsVersion}
                  onChange={(e) => update('windowsVersion', e.target.value)}
                  className="field"
                />
              </Field>
            </div>

            <Field label="Attachment (coming soon)" htmlFor="attachment">
              <input
                id="attachment"
                name="attachment"
                type="file"
                disabled
                className="field disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="mt-2 text-xs text-slate-500">
                File uploads will be enabled when the support backend ships.
              </p>
            </Field>

            <Button type="submit" className="w-full sm:w-auto">
              Open email draft
            </Button>
          </form>

          <div className="space-y-5">
            <AiSupportPlaceholder />
            <div className="panel p-5 text-sm text-slate-400">
              <h2 className="font-display text-lg font-semibold text-white">Before you write</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Check the Help Center for common audio and Discord fixes.</li>
                <li>Include whether Free or Pro is activated.</li>
                <li>Mention if the issue started after an update.</li>
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
      `}</style>
    </>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
    </div>
  )
}
