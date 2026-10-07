import { useEffect, useId, useState } from 'react'

export const APP_NAME = 'VaultShare'
export const APP_SUBTITLE = 'Secret Sharing Based Information Security System'

// The mark: a vault dial split into three shares, with a keyhole in the middle.
const SHARD_PATHS = [
  'M7.73 8.44A10.5 10.5 0 0 1 24.27 8.44L20.1 11.7A5.2 5.2 0 0 0 11.9 11.7Z',
  'M26.69 12.62A10.5 10.5 0 0 1 18.41 26.95L17.68 21.7A5.2 5.2 0 0 0 21.77 14.6Z',
  'M13.59 26.95A10.5 10.5 0 0 1 5.31 12.62L10.23 14.6A5.2 5.2 0 0 0 14.32 21.7Z',
]

export function LogoMark({ size = 34 }) {
  const id = useId()
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fd6c4" />
          <stop offset="1" stopColor="#7eb6e0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#0f1b1f" />
      {SHARD_PATHS.map((d) => (
        <path key={d} d={d} fill={`url(#${id})`} />
      ))}
      <circle cx="16" cy="15" r="1.7" fill="#e4eeec" />
      <path d="M15.2 15.6h1.6l.5 2.6h-2.6z" fill="#e4eeec" />
    </svg>
  )
}

export function Wordmark({ className = '' }) {
  return (
    <span className={`font-extrabold tracking-tight text-ink ${className}`}>
      Vault<span className="text-gradient">Share</span>
    </span>
  )
}

// Small live dot: is the backend reachable?
export function ApiStatus() {
  const [state, setState] = useState('checking')
  useEffect(() => {
    let alive = true
    const ping = () =>
      fetch('/api/health')
        .then((r) => alive && setState(r.ok ? 'online' : 'offline'))
        .catch(() => alive && setState('offline'))
    ping()
    const id = setInterval(ping, 8000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])
  const look = {
    checking: ['bg-faint', 'text-faint', '…'],
    online: ['bg-mint-400 shadow-[0_0_10px_rgb(116_203_143/0.9)]', 'text-mint-300', 'Online'],
    offline: ['bg-coral-400 shadow-[0_0_10px_rgb(238_133_119/0.9)]', 'text-coral-300', 'Backend offline'],
  }[state]
  return (
    <div className="flex items-center gap-2 text-xs font-medium" title={state === 'offline' ? 'Start run-backend.cmd' : undefined}>
      <span className={`h-2 w-2 rounded-full ${look[0]}`} />
      <span className={look[1]}>{look[2]}</span>
    </div>
  )
}
