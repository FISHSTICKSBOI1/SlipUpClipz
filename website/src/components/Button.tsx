import { Link } from 'react-router-dom'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-glow-purple to-glow-magenta text-white shadow-glow hover:brightness-110',
  secondary:
    'border border-ink-border bg-ink-panel/70 text-slate-100 hover:border-glow-purple/60 hover:bg-ink-panel',
  ghost: 'text-slate-300 hover:text-white',
}

type CommonProps = {
  children: ReactNode
  className?: string
  variant?: ButtonVariant
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
    to?: undefined
    href?: undefined
  }

type ButtonAsLink = CommonProps & {
  to: string
  href?: undefined
}

type ButtonAsAnchor = CommonProps & {
  href: string
  to?: undefined
  target?: string
  rel?: string
}

export function Button(props: ButtonAsButton | ButtonAsLink | ButtonAsAnchor) {
  const { children, className = '', variant = 'primary' } = props
  const classes = `inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow-purple disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`

  if ('to' in props && props.to) {
    return (
      <Link to={props.to} className={classes}>
        {children}
      </Link>
    )
  }

  if ('href' in props && props.href) {
    return (
      <a
        href={props.href}
        className={classes}
        target={props.target}
        rel={props.rel ?? (props.target === '_blank' ? 'noreferrer' : undefined)}
      >
        {children}
      </a>
    )
  }

  const { type = 'button', ...rest } = props as ButtonAsButton
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
