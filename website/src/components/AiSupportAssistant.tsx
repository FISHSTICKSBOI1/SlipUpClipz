import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './Button'
import { SITE } from '../config/site'

const STARTER_QUESTIONS = [
  'Why is my clip silent?',
  'How do I use SlipUpClipz in Discord?',
  'How do I change my Clip hotkey?',
  "Why can't I hear my soundboard?",
  'How do automatic updates work?',
] as const

const MAX_USER_MESSAGE = 1000
const MAX_STORED_MESSAGES = 12
const SUBMIT_COOLDOWN_MS = 3000
const UNAVAILABLE_MESSAGE =
  'AI support requires the Netlify development server or a deployed Netlify site with functions enabled. Run npm run website:netlify-dev for full local testing.'

type ChatRole = 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function trimHistory(messages: ChatMessage[]) {
  return messages.slice(-MAX_STORED_MESSAGES)
}

export function AiSupportAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [serviceUnavailable, setServiceUnavailable] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const inputId = useId()
  const listId = useId()

  const isLoading = status === 'loading'
  const isCooldown = Date.now() < cooldownUntil
  const sendDisabled =
    isLoading || isCooldown || serviceUnavailable || !input.trim() || input.trim().length > MAX_USER_MESSAGE

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
    if (!message || isLoading || isCooldown) return
    if (message.length > MAX_USER_MESSAGE) {
      setStatus('error')
      setStatusMessage(`Messages must be ${MAX_USER_MESSAGE} characters or fewer.`)
      return
    }

    const previousMessages = messages
    setStatus('idle')
    setStatusMessage('')

    const userMessage: ChatMessage = { id: createId(), role: 'user', content: message }
    const nextMessages = trimHistory([...messages, userMessage])
    setMessages(nextMessages)
    setInput('')
    setStatus('loading')

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
        }),
      })

      let data: { reply?: string; error?: string } = {}
      try {
        data = (await response.json()) as { reply?: string; error?: string }
      } catch {
        data = {}
      }

      if (response.status === 404) {
        setServiceUnavailable(true)
        setStatus('error')
        setStatusMessage(UNAVAILABLE_MESSAGE)
        setMessages(previousMessages)
        return
      }

      if (!response.ok || !data.reply) {
        setStatus('error')
        setStatusMessage(
          data.error ||
            'AI support is temporarily unavailable. Please try the Help Center or email support.',
        )
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
      setMessages(previousMessages)
    } finally {
      inputRef.current?.focus()
    }
  }

  function handleSubmit() {
    void sendMessage(input)
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
    inputRef.current?.focus()
  }

  const directMailto = `mailto:${SITE.supportEmail}?subject=${encodeURIComponent(SITE.supportMailtoSubject)}`

  return (
    <section className="panel relative overflow-hidden p-6 sm:p-8">
      <div className="absolute inset-0 bg-gradient-to-r from-glow-purple/10 via-transparent to-glow-magenta/10" />
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-ink/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-glow-cyan">
          AI Support
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold text-white">AI Support Assistant</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Ask about installation, clipping, Discord routing, soundboard playback, updates, and Pro
          features. Answers are based on the public Help Center.
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
          className="mt-5 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-ink-border/80 bg-ink/40 p-4"
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
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-100">
              {statusMessage}{' '}
              <Link to={SITE.paths.help} className="font-semibold underline underline-offset-2">
                Help Center
              </Link>{' '}
              ·{' '}
              <Link to={SITE.paths.contact} className="font-semibold underline underline-offset-2">
                Contact
              </Link>{' '}
              ·{' '}
              <a href={directMailto} className="font-semibold underline underline-offset-2">
                {SITE.supportEmail}
              </a>
            </p>
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
            placeholder="Example: Why is my clip silent?"
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