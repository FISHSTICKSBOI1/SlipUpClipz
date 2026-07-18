import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from './Button'
import { SITE } from '../config/site'

const STARTER_QUESTIONS = [
  'How do I capture a clip?',
  'Why is my microphone not working?',
  'How do I use the soundboard in Discord?',
  'What is included with Pro?',
  'Where is my license key?',
] as const

const MAX_USER_MESSAGE = 1000
const MAX_STORED_MESSAGES = 12
const SUBMIT_COOLDOWN_MS = 3000
const UNAVAILABLE_MESSAGE =
  'AI support is currently unavailable. Please use the Help Center or email support.'

type ChatRole = 'user' | 'assistant'
type FeedbackValue = 'up' | 'down'

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  feedback?: FeedbackValue
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function trimHistory(messages: ChatMessage[]) {
  return messages.slice(-MAX_STORED_MESSAGES)
}

function detectPlanInterest(text: string): 'free' | 'pro' | 'unspecified' {
  const lower = text.toLowerCase()
  if (/\bpro\b/.test(lower) || /license|subscription|\$4\.99/.test(lower)) return 'pro'
  if (/\bfree\b/.test(lower)) return 'free'
  return 'unspecified'
}

export function AiSupportAssistant() {
  const location = useLocation()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [serviceUnavailable, setServiceUnavailable] = useState(false)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)
  const inputId = useId()
  const listId = useId()

  const isLoading = status === 'loading'
  const isCooldown = Date.now() < cooldownUntil
  const sendDisabled =
    isLoading ||
    isCooldown ||
    serviceUnavailable ||
    !input.trim() ||
    input.trim().length > MAX_USER_MESSAGE

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, isLoading])

  useEffect(() => {
    if (status === 'error' || statusMessage) {
      statusRef.current?.focus()
    }
  }, [status, statusMessage])

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim()
    if (!message || isLoading || isCooldown || sendingRef.current || serviceUnavailable) return
    if (message.length > MAX_USER_MESSAGE) {
      setStatus('error')
      setStatusMessage(`Messages must be ${MAX_USER_MESSAGE} characters or fewer.`)
      return
    }

    const previousMessages = messages
    setStatus('idle')
    setStatusMessage('')
    setLastFailedMessage(null)

    const userMessage: ChatMessage = { id: createId(), role: 'user', content: message }
    const nextMessages = trimHistory([...messages, userMessage])
    setMessages(nextMessages)
    setInput('')
    setStatus('loading')
    sendingRef.current = true

    try {
      const response = await fetch(SITE.supportAssistantEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: previousMessages.map((item) => ({
            role: item.role,
            content: item.content,
          })),
          pageContext: {
            currentPage: location.pathname || '/',
            websiteVersion: SITE.currentVersion,
            planInterest: detectPlanInterest(message),
          },
        }),
      })

      let data: { reply?: string; error?: string } = {}
      try {
        data = (await response.json()) as { reply?: string; error?: string }
      } catch {
        data = {}
      }

      if (response.status === 404 || response.status === 503) {
        setServiceUnavailable(true)
        setStatus('error')
        setStatusMessage(data.error || UNAVAILABLE_MESSAGE)
        setLastFailedMessage(message)
        setMessages(previousMessages)
        return
      }

      if (response.status === 429) {
        setStatus('error')
        setStatusMessage(
          data.error || 'AI support is busy right now. Please wait a moment and try again.',
        )
        setLastFailedMessage(message)
        setCooldownUntil(Date.now() + 60_000)
        return
      }

      if (!response.ok || !data.reply) {
        setStatus('error')
        setStatusMessage(
          response.status >= 500
            ? 'AI support encountered a temporary server error. Please try again shortly.'
            : data.error || 'AI support could not process that request. Please try again.',
        )
        setLastFailedMessage(message)
        return
      }

      setMessages(
        trimHistory([
          ...nextMessages,
          { id: createId(), role: 'assistant', content: data.reply },
        ]),
      )
      setStatus('idle')
      setCooldownUntil(Date.now() + SUBMIT_COOLDOWN_MS)
    } catch {
      setStatus('error')
      setStatusMessage(UNAVAILABLE_MESSAGE)
      setServiceUnavailable(true)
      setLastFailedMessage(message)
      setMessages(previousMessages)
    } finally {
      sendingRef.current = false
      inputRef.current?.focus()
    }
  }

  function handleSubmit() {
    void sendMessage(input)
  }

  function handleRetry() {
    if (!lastFailedMessage || isLoading) return
    void sendMessage(lastFailedMessage)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!sendDisabled) handleSubmit()
    }
  }

  function handleClear() {
    if (!messages.length) return
    if (!window.confirm('Clear this conversation?')) return
    setMessages([])
    setStatus('idle')
    setStatusMessage('')
    setLastFailedMessage(null)
    inputRef.current?.focus()
  }

  function setFeedback(messageId: string, value: FeedbackValue) {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId && message.role === 'assistant'
          ? { ...message, feedback: message.feedback === value ? undefined : value }
          : message,
      ),
    )
  }

  return (
    <section className="panel relative overflow-hidden p-6 sm:p-8">
      <div className="absolute inset-0 bg-gradient-to-r from-glow-purple/10 via-transparent to-glow-magenta/10" />
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-ink/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-glow-cyan">
          AI Support
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold text-white">AI Support Assistant</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Get step-by-step help with capture, Discord routing, soundboard playback, updates, and Pro
          features. Conversation history stays while this panel is open.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {STARTER_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => void sendMessage(question)}
              disabled={isLoading || serviceUnavailable}
              className="rounded-full border border-ink-border bg-ink/50 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-glow-purple/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>

        <div
          id={listId}
          ref={messagesRef}
          className="mt-5 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-ink-border/80 bg-ink/40 p-4"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">
              Ask a question to get started, or choose a suggested prompt above.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-8 bg-glow-purple/15 text-slate-100'
                    : 'mr-8 border border-ink-border/70 bg-ink-raised/70 text-slate-300'
                }`}
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </p>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.role === 'assistant' ? (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Helpful answer"
                      aria-pressed={message.feedback === 'up'}
                      onClick={() => setFeedback(message.id, 'up')}
                      className={`rounded-md border px-2 py-1 text-xs transition ${
                        message.feedback === 'up'
                          ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                          : 'border-ink-border text-slate-400 hover:text-white'
                      }`}
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      aria-label="Unhelpful answer"
                      aria-pressed={message.feedback === 'down'}
                      onClick={() => setFeedback(message.id, 'down')}
                      className={`rounded-md border px-2 py-1 text-xs transition ${
                        message.feedback === 'down'
                          ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
                          : 'border-ink-border text-slate-400 hover:text-white'
                      }`}
                    >
                      👎
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
          {isLoading ? (
            <p className="text-sm text-slate-400" role="status">
              Assistant is typing…
            </p>
          ) : null}
        </div>

        <div
          ref={statusRef}
          tabIndex={-1}
          aria-live="assertive"
          className="mt-3 min-h-[1px] text-sm"
        >
          {status === 'error' && statusMessage ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-100">
              <p>{statusMessage}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {lastFailedMessage && !serviceUnavailable ? (
                  <Button type="button" variant="secondary" className="!px-3 !py-1.5 !text-xs" onClick={handleRetry}>
                    Retry
                  </Button>
                ) : null}
                <Link to={SITE.paths.help} className="font-semibold underline underline-offset-2">
                  Help Center
                </Link>
                <Link to={SITE.paths.contact} className="font-semibold underline underline-offset-2">
                  Contact
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-200">
            Your question
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            rows={3}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_USER_MESSAGE}
            disabled={isLoading || serviceUnavailable}
            placeholder="Example: Why is my microphone not working?"
            className="field w-full resize-y"
            aria-describedby={`${inputId}-hint`}
          />
          <p id={`${inputId}-hint`} className="text-xs text-slate-500">
            Do not enter passwords, payment information, complete license keys, or private
            recordings. Up to {MAX_USER_MESSAGE.toLocaleString()} characters. Enter to send,
            Shift+Enter for a new line.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" onClick={handleSubmit} disabled={sendDisabled} className="btn-lift">
            {isLoading ? 'Sending…' : 'Send'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClear}
            disabled={isLoading || messages.length === 0}
            className="btn-lift"
          >
            Clear conversation
          </Button>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Prefer a human? Visit the{' '}
          <Link to={SITE.paths.help} className="text-glow-magenta underline-offset-2 hover:underline">
            Help Center
          </Link>{' '}
          or{' '}
          <Link
            to={SITE.paths.contact}
            className="text-glow-magenta underline-offset-2 hover:underline"
          >
            Contact Support
          </Link>
          .
        </p>
      </div>

      <style>{`
        .field {
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
    </section>
  )
}
