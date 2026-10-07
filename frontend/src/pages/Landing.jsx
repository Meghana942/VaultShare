import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { APP_SUBTITLE, LogoMark, Wordmark } from '../components/Brand'

// Decorative curve drifting behind the title: a smooth polynomial with five share points.
const W = 1200
const H = 420
const f = (x) => 210 - 120 * Math.sin((x / W) * Math.PI * 1.15 + 0.35)
const CURVE = Array.from({ length: 121 }, (_, i) => {
  const x = (i / 120) * W
  return `${i ? 'L' : 'M'}${x.toFixed(1)},${f(x).toFixed(1)}`
}).join('')
const POINTS = [170, 390, 610, 830, 1050]

function BackdropCurve() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-x-0 top-1/2 h-[60vh] w-full -translate-y-1/2 opacity-60" aria-hidden="true">
      <defs>
        <linearGradient id="landing-curve" x1="0" x2="1">
          <stop offset="0" stopColor="#5cc8b2" stopOpacity="0" />
          <stop offset="0.2" stopColor="#5cc8b2" stopOpacity="0.7" />
          <stop offset="0.8" stopColor="#7eb6e0" stopOpacity="0.7" />
          <stop offset="1" stopColor="#7eb6e0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={CURVE} fill="none" stroke="url(#landing-curve)" strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset="1" className="animate-draw [animation-delay:200ms]" />
      {POINTS.map((x, i) => (
        <g key={x} className="animate-pop" style={{ animationDelay: `${1 + i * 0.2}s`, transformOrigin: `${x}px ${f(x)}px` }}>
          <circle cx={x} cy={f(x)} r="14" fill="#5cc8b2" opacity="0.12" className="animate-breathe" style={{ animationDelay: `${i * 0.6}s` }} />
          <circle cx={x} cy={f(x)} r="5" fill="#0a1316" stroke={i % 2 ? '#7eb6e0' : '#5cc8b2'} strokeWidth="2" />
        </g>
      ))}
    </svg>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e) => e.key === 'Enter' && navigate('/vaults')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <BackdropCurve />

      <div className="relative flex flex-col items-center text-center">
        <div className="animate-rise">
          <LogoMark size={72} />
        </div>
        <h1 className="mt-8 animate-rise text-6xl [animation-delay:150ms] sm:text-8xl">
          <Wordmark />
        </h1>
        <button
          onClick={() => navigate('/vaults')}
          className="group mt-12 inline-flex animate-rise items-center gap-2 rounded-full bg-linear-to-r from-sea-400 to-sky-400 px-8 py-3.5 text-sm font-bold text-sea-950 shadow-[0_14px_40px_-14px_rgb(92_200_178/0.7)] transition hover:brightness-110 [animation-delay:300ms]"
        >
          Enter
          <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      <footer className="absolute inset-x-0 bottom-8 animate-rise text-center text-xs font-semibold tracking-[0.3em] text-muted uppercase [animation-delay:500ms] sm:text-sm">
        {APP_SUBTITLE}
      </footer>
    </div>
  )
}
