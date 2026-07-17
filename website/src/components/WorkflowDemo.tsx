import { WORKFLOW_STEPS } from '../data/features'

const ICONS = ['◎', '✂', '+', '▶'] as const

export function WorkflowDemo() {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {WORKFLOW_STEPS.map((step, index) => (
        <li
          key={step.title}
          className="panel relative overflow-hidden p-5 motion-safe:animate-fade-up"
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <span
            className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-glow-purple/15 text-lg text-glow-magenta"
            aria-hidden
          >
            {ICONS[index]}
          </span>
          <h3 className="font-display text-lg font-semibold text-white">{step.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.body}</p>
          {index < WORKFLOW_STEPS.length - 1 ? (
            <span
              className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 text-slate-600 lg:block"
              aria-hidden
            >
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
