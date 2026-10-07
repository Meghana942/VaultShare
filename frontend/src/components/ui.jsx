import { createContext, useCallback, useContext, useState } from 'react'
import { Check, CircleCheck, CircleX, Copy, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react'

export function PageHeader({ title, meta, actions }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {meta && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`rounded-3xl border border-line bg-panel/70 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.7)] backdrop-blur-md ${className}`} {...rest}>
      {children}
    </div>
  )
}

const BUTTON_VARIANTS = {
  primary: 'bg-linear-to-r from-sea-400 to-sky-400 text-sea-950 font-semibold hover:brightness-110 shadow-[0_10px_30px_-12px_rgb(92_200_178/0.55)] disabled:opacity-35 disabled:shadow-none',
  success: 'bg-mint-400 text-mint-950 font-semibold hover:bg-mint-300 shadow-[0_10px_30px_-12px_rgb(116_203_143/0.55)] disabled:opacity-30 disabled:shadow-none',
  danger: 'bg-coral-400/90 text-coral-950 font-semibold hover:bg-coral-400 disabled:opacity-30',
  secondary: 'border border-line-strong bg-raised/80 text-ink hover:border-sea-400/50 disabled:opacity-40',
  ghost: 'text-muted hover:bg-white/5 hover:text-ink disabled:opacity-40',
}

export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, className = '', children, ...rest }) {
  const sizes = { sm: 'px-3 py-1.5 text-xs gap-1.5', md: 'px-4 py-2.5 text-sm gap-2', lg: 'px-6 py-3 text-sm gap-2' }
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 disabled:cursor-not-allowed ${sizes[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <LoaderCircle size={size === 'sm' ? 14 : 16} className="animate-spin" /> : Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}

const BADGE_TONES = {
  slate: 'bg-white/5 text-muted ring-white/10',
  sea: 'bg-sea-400/10 text-sea-300 ring-sea-400/25',
  sky: 'bg-sky-400/10 text-sky-300 ring-sky-400/25',
  green: 'bg-mint-400/10 text-mint-300 ring-mint-400/25',
  red: 'bg-coral-400/10 text-coral-300 ring-coral-400/25',
  sand: 'bg-sand-400/10 text-sand-300 ring-sand-400/25',
}

export function Badge({ tone = 'slate', icon: Icon, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE_TONES[tone]} ${className}`}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  )
}

const CALLOUT_TONES = {
  info: ['border-sea-400/25 bg-sea-400/[0.06]', 'text-sea-300', Info],
  success: ['border-mint-400/25 bg-mint-400/[0.06]', 'text-mint-300', CircleCheck],
  danger: ['border-coral-400/30 bg-coral-400/[0.07]', 'text-coral-300', CircleX],
  warning: ['border-sand-400/30 bg-sand-400/[0.07]', 'text-sand-300', TriangleAlert],
}

export function Callout({ tone = 'info', title, children, className = '' }) {
  const [cls, iconCls, Icon] = CALLOUT_TONES[tone]
  return (
    <div className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm text-ink ${cls} ${className}`}>
      <Icon size={18} className={`mt-0.5 shrink-0 ${iconCls}`} />
      <div className="min-w-0">
        {title && <div className={`font-semibold ${iconCls}`}>{title}</div>}
        {children && <div className={title ? 'mt-0.5 text-muted' : ''}>{children}</div>}
      </div>
    </div>
  )
}

export function CopyButton({ text, label = 'Copy', size = 'sm' }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="secondary"
      size={size}
      icon={copied ? Check : Copy}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  )
}

export function Mono({ children, className = '' }) {
  return <code className={`break-anywhere rounded-lg bg-white/[0.05] px-1.5 py-0.5 font-mono text-[0.8em] text-sky-100/80 ${className}`}>{children}</code>
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-muted">
      <LoaderCircle size={16} className="animate-spin text-accent" /> {label}
    </div>
  )
}

export const inputClass =
  'w-full rounded-2xl border border-line-strong bg-raised/80 px-4 py-2.5 text-sm text-ink placeholder:text-faint transition focus:border-sea-400/70 focus:ring-4 focus:ring-sea-400/10 focus:outline-none'

// Segmented "k of t" approval meter.
export function ShareMeter({ verified, threshold }) {
  const done = verified >= threshold
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className={`text-5xl font-extrabold tracking-tight ${done ? 'text-mint-300' : 'text-ink'}`}>
          {Math.min(verified, threshold)}
          <span className="text-2xl font-semibold text-faint"> / {threshold}</span>
        </span>
        <span className="text-sm text-muted">{done ? 'ready to unlock' : 'approvals'}</span>
      </div>
      <div className="mt-4 flex h-2.5 gap-2">
        {Array.from({ length: threshold }, (_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-all duration-700 ${
              i < verified ? (done ? 'bg-mint-400' : 'bg-linear-to-r from-sea-400 to-sky-400') : 'bg-white/[0.07]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// ---- toasts --------------------------------------------------------------

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  const tones = {
    info: 'border-line-strong bg-raised/95 text-ink',
    success: 'border-mint-400/40 bg-mint-950/95 text-mint-100',
    error: 'border-coral-400/40 bg-coral-950/95 text-coral-100',
  }
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`flex animate-rise items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${tones[t.tone]}`}>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} className="opacity-60 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
