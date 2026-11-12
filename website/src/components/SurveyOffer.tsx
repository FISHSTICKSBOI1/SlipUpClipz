import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './Button'
import { PriceDisclosure } from './PriceDisclosure'
import { SITE } from '../config/site'
import { DOWNLOAD_OPTIONS, HEARD_OPTIONS } from '../data/surveyOptions'
import { startProCheckout } from '../lib/checkout'
import { usePricingQuote } from '../lib/pricingQuote'

type Stage = 'form' | 'thanks' | 'code'

export function SurveyOffer({ prominence = 'prominent' }: { prominence?: 'compact' | 'prominent' }) {
  const quote = usePricingQuote()
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const submissionId = useRef(crypto.randomUUID())
  const pendingSubmission = useRef(false)
  const generation = useRef(0)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [heardFrom, setHeardFrom] = useState('')
  const [heardFromOther, setHeardFromOther] = useState('')
  const [downloadSource, setDownloadSource] = useState('')
  const [downloadSourceOther, setDownloadSourceOther] = useState('')
  const [feedback, setFeedback] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [copied, setCopied] = useState(false)
  const [stage, setStage] = useState<Stage>('form')
  const [open, setOpen] = useState(false)

  function resetAnswers() {
    generation.current += 1
    submissionId.current = crypto.randomUUID()
    setHeardFrom('')
    setHeardFromOther('')
    setDownloadSource('')
    setDownloadSourceOther('')
    setFeedback('')
    setCompany('')
    setError(null)
    setCopied(false)
    setStartedAt(Date.now())
  }

  function returnToForm() {
    setStage('form')
    resetAnswers()
  }

  function openSurvey() {
    returnToForm()
    setOpen(true)
  }

  function closeSurvey() {
    setOpen(false)
    setStage('form')
    resetAnswers()
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pendingSubmission.current) return
    pendingSubmission.current = true
    const attempt = generation.current
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(SITE.surveyEndpoint, {
        method: 'POST',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submissionId.current,
          startedAt,
          heardFrom,
          heardFromOther,
          downloadSource,
          downloadSourceOther,
          feedback,
          company,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error || 'We could not confirm that your answers were saved. Please try again.')
      }
      if (attempt === generation.current) setStage('thanks')
    } catch (submitError) {
      if (attempt === generation.current) setError(submitError instanceof Error ? submitError.message : 'Unable to save feedback right now.')
    } finally {
      pendingSubmission.current = false
      setIsSubmitting(false)
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(SITE.promotionCode)
      setCopied(true)
    } catch {
      setCopied(false)
      setError('Select the code and copy it manually.')
    }
  }

  async function continueToCheckout() {
    if (isCheckingOut) return
    setError(null)
    setIsCheckingOut(true)
    try {
      const result = await startProCheckout({ promotionCode: SITE.promotionCode })
      window.location.assign(result.url!)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to start checkout')
      setIsCheckingOut(false)
    }
  }

  const compact = prominence === 'compact'

  return (
    <section id="feedback" className="scroll-mt-28">
      <div
        className={`rounded-2xl border p-5 sm:p-6 ${
          compact
            ? 'border-ink-border bg-ink-panel/90'
            : 'border-glow-purple/40 bg-gradient-to-b from-glow-purple/15 to-ink-panel sm:p-8'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-glow-magenta">
          {compact ? 'Survey' : 'Thank-you discount'}
        </p>
        <h2
          className={`mt-3 font-display font-bold text-white ${
            compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
          }`}
        >
          Small survey. Better SlipUpClipz.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
          Tell us how you found the app and what you would improve. The advertised thank-you offer
          is $1 off the first year of Pro with SURVEY20, subject to availability at checkout.
          You can buy Pro at the regular price without taking the survey.
        </p>
        <Button
          type="button"
          className="btn-lift mt-5 min-h-[44px] w-full sm:w-auto"
          onClick={openSurvey}
        >
          Take the Survey
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="w-[min(40rem,calc(100vw-2rem))] max-w-none border-0 bg-transparent p-0 backdrop:bg-black/70"
        onClose={() => {
          setOpen(false)
          setStage('form')
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeSurvey()
        }}
      >
        <div className="max-h-[min(40rem,calc(100vh-2rem))] overflow-auto rounded-2xl border border-ink-border bg-ink-panel p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-display text-xl font-bold text-white">
              {stage === 'code' ? 'Your first-year discount' : 'Help Improve SlipUpClipz'}
            </h2>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-slate-400 transition hover:text-white"
              aria-label="Close survey"
              onClick={closeSurvey}
            >
              ✕
            </button>
          </div>

          {stage === 'form' ? (
            <form className="relative mt-5 space-y-6" onSubmit={(event) => void handleSubmit(event)} noValidate>
              <fieldset>
                <legend className="text-sm font-semibold text-white">
                  How did you hear about SlipUpClipz?
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {HEARD_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-ink-border/80 bg-ink/40 px-3 py-2 text-sm text-slate-200"
                    >
                      <input
                        type="radio"
                        name="heardFrom"
                        value={option.id}
                        checked={heardFrom === option.id}
                        onChange={() => setHeardFrom(option.id)}
                        className="accent-glow-purple"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {heardFrom === 'other' ? (
                  <input
                    value={heardFromOther}
                    onChange={(event) => setHeardFromOther(event.target.value)}
                    maxLength={80}
                    aria-label="Other way you heard about SlipUpClipz"
                    placeholder="Where did you hear about it?"
                    className="mt-3 w-full rounded-xl border border-ink-border bg-ink px-3 py-3 text-sm text-white"
                  />
                ) : null}
              </fieldset>

              <fieldset>
                <legend className="text-sm font-semibold text-white">
                  Where did you download SlipUpClipz from?
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {DOWNLOAD_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-ink-border/80 bg-ink/40 px-3 py-2 text-sm text-slate-200"
                    >
                      <input
                        type="radio"
                        name="downloadSource"
                        value={option.id}
                        checked={downloadSource === option.id}
                        onChange={() => setDownloadSource(option.id)}
                        className="accent-glow-purple"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {downloadSource === 'other' ? (
                  <input
                    value={downloadSourceOther}
                    onChange={(event) => setDownloadSourceOther(event.target.value)}
                    maxLength={80}
                    aria-label="Other download source"
                    placeholder="Where did you download it?"
                    className="mt-3 w-full rounded-xl border border-ink-border bg-ink px-3 py-3 text-sm text-white"
                  />
                ) : null}
              </fieldset>

              <label className="block">
                <span className="text-sm font-semibold text-white">
                  What improvements or new features would you like to see? (Optional)
                </span>
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="A feature, a fix, or anything that would make the app better."
                  className="mt-3 w-full rounded-xl border border-ink-border bg-ink px-3 py-3 text-sm text-white"
                />
                <span className="mt-2 block text-xs text-slate-500">
                  Please do not include names, email addresses, license keys, or other private information.
                </span>
              </label>

              <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                <label>
                  Company
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                  />
                </label>
              </div>

              <p className="text-xs leading-relaxed text-slate-500">
                We store these answers privately so we can see how people find SlipUpClipz and what
                to build next. We do not ask for your name, email, or payment details. A shortened
                hash of your network address is stored with the answers. A full salted hash and
                submission times are kept separately to limit repeat submissions. Feedback is
                not published on the site. See the{' '}
                <Link to={SITE.paths.privacy} className="text-glow-magenta hover:underline" onClick={closeSurvey}>
                  Privacy Policy
                </Link>{' '}
                for details.
              </p>

              <Button type="submit" className="btn-lift min-h-[44px] w-full sm:w-auto" disabled={isSubmitting}>
                {isSubmitting ? 'Saving feedback…' : 'Submit feedback'}
              </Button>
            </form>
          ) : (
            <div className="mt-5 space-y-5" role="status">
              {stage === 'thanks' ? (
                <>
                  <p className="text-sm leading-relaxed text-slate-200">
                    Your feedback was saved. Thanks for helping improve SlipUpClipz. You can now
                    view the advertised first-year offer. Check that Stripe applies it before paying.
                  </p>
                  <Button
                    type="button"
                    className="btn-lift min-h-[44px] w-full sm:w-auto"
                    onClick={() => setStage('code')}
                  >
                    View the $1 first-year offer
                  </Button>
                </>
              ) : (
                <div className="space-y-4 rounded-2xl border border-glow-purple/40 bg-ink/50 p-5">
                  <p className="text-sm leading-relaxed text-slate-200">
                    Try {SITE.promotionCode} for the advertised $1 first-year offer. Availability
                    is confirmed at checkout. Do not pay unless the total is what you expect.
                  </p>
                  <p className="font-display text-3xl font-bold tracking-[0.14em] text-white">
                    {SITE.promotionCode}
                  </p>
                  <PriceDisclosure quote={quote} />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button type="button" variant="secondary" className="min-h-[44px]" onClick={() => void copyCode()}>
                      {copied ? 'Copied' : 'Copy Code'}
                    </Button>
                    <Button
                      type="button"
                      className="btn-lift min-h-[44px]"
                      disabled={isCheckingOut}
                      onClick={() => void continueToCheckout()}
                    >
                      {isCheckingOut ? 'Opening secure checkout…' : 'Continue to Checkout'}
                    </Button>
                  </div>
                </div>
              )}
              <button
                type="button"
                className="text-sm font-semibold text-slate-400 underline-offset-2 hover:text-white hover:underline"
                onClick={returnToForm}
              >
                Back to the survey
              </button>
            </div>
          )}

          {error ? (
            <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </dialog>
    </section>
  )
}
