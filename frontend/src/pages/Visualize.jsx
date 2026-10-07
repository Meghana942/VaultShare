import { useState } from 'react'
import { CircleCheck, Dices, EyeOff } from 'lucide-react'
import { evalPoly, lagrangeAt, niceStep, randomCurve } from '../lib/poly'
import { Button, Card, PageHeader } from '../components/ui'

const ROLES = ['CEO', 'CTO', 'CFO', 'Legal', 'CISO']
const T = 3 // shares needed (a parabola)

const W = 960
const H = 360
const M = { l: 44, r: 20, t: 28, b: 36 }
const X0 = -0.6
const X1 = 5.6

const C = {
  grid: '#1d3036', tick: '#5d7778', axis: '#5cc8b2', curveA: '#5cc8b2', curveB: '#7eb6e0',
  point: '#7eb6e0', dim: '#2a4148', family: '#e5b866', found: '#74cb8f', bg: '#0a1316',
}

export default function Visualize() {
  const [coeffs, setCoeffs] = useState(() => randomCurve())
  const [selected, setSelected] = useState([])

  const secret = coeffs[0]
  const shares = ROLES.map((role, i) => ({ role, x: i + 1, y: evalPoly(coeffs, i + 1) }))
  const chosen = shares.filter((s) => selected.includes(s.x))
  const points = chosen.map((s) => [s.x, s.y])
  const k = points.length
  const found = k >= T ? lagrangeAt(points, 0) : null

  const toggle = (x) => setSelected((sel) => (sel.includes(x) ? sel.filter((v) => v !== x) : [...sel, x]))

  return (
    <>
      <PageHeader
        title="Visualize"
        actions={
          <Button variant="secondary" icon={Dices} onClick={() => { setCoeffs(randomCurve()); setSelected([]) }}>
            New curve
          </Button>
        }
      />
      <Card className="p-4 sm:p-6">
        <Plot coeffs={coeffs} shares={shares} selected={selected} points={points} k={k} secret={secret} found={found} onToggle={toggle} />

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {shares.map((s) => {
            const on = selected.includes(s.x)
            return (
              <button
                key={s.x}
                onClick={() => toggle(s.x)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  on ? 'bg-sky-400/20 text-sky-100 ring-1 ring-sky-400/60' : 'text-muted ring-1 ring-line-strong hover:text-ink'
                }`}
              >
                {s.role}
              </button>
            )
          })}
        </div>

        <div className="mt-5 flex min-h-8 items-center justify-center gap-2 text-center text-base font-semibold">
          {k === 0 && <span className="text-muted">Select custodians to combine their shares</span>}
          {k > 0 && k < T && (
            <span className="inline-flex items-center gap-2 text-sand-300">
              <EyeOff size={18} /> {k} of {T} shares: any secret fits
            </span>
          )}
          {k >= T && (
            <span className="inline-flex items-center gap-2 text-mint-300">
              <CircleCheck size={18} /> {k} shares: one curve, secret = {Math.round(found)}
            </span>
          )}
        </div>
      </Card>
    </>
  )
}

function Plot({ coeffs, shares, selected, points, k, secret, found, onToggle }) {
  // y-range from the curve itself
  const ys = [secret]
  for (let i = 0; i <= 80; i++) ys.push(evalPoly(coeffs, X0 + ((X1 - X0) * i) / 80))
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const pad = (hi - lo) * 0.18 || 10
  const y0 = lo - pad
  const y1 = hi + pad

  const sx = (x) => M.l + ((x - X0) / (X1 - X0)) * (W - M.l - M.r)
  const sy = (y) => M.t + ((y1 - y) / (y1 - y0)) * (H - M.t - M.b)
  const clamp = (y) => Math.max(y0 - (y1 - y0) * 2, Math.min(y1 + (y1 - y0) * 2, y))
  const path = (f) => {
    let d = ''
    for (let i = 0; i <= 200; i++) {
      const x = X0 + ((X1 - X0) * i) / 200
      d += `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(clamp(f(x))).toFixed(1)}`
    }
    return d
  }

  // With fewer than T points, every intercept is reachable: f_c(x) = L(x) + c * prod(x - x_i)
  const family = []
  if (k > 0 && k < T) {
    const L = (x) => lagrangeAt(points, x)
    const prod = (x) => points.reduce((acc, [xi]) => acc * (x - xi), 1)
    for (let i = 0; i < 7; i++) {
      const target = y0 + ((y1 - y0) * (i + 0.5)) / 7
      const c = (target - L(0)) / prod(0)
      family.push({ target, f: (x) => L(x) + c * prod(x) })
    }
  }

  const step = niceStep(y1 - y0)
  const ticks = []
  for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) ticks.push(v)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img" aria-label="Secret sharing curve">
      <defs>
        <clipPath id="viz-clip">
          <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} />
        </clipPath>
        <linearGradient id="viz-curve" x1="0" x2="1">
          <stop offset="0" stopColor={C.curveA} />
          <stop offset="1" stopColor={C.curveB} />
        </linearGradient>
        <filter id="viz-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {ticks.map((v) => (
        <g key={v}>
          <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} stroke={C.grid} />
          <text x={M.l - 8} y={sy(v) + 4} textAnchor="end" fontSize="11" fill={C.tick}>{Math.round(v)}</text>
        </g>
      ))}
      <line x1={sx(0)} x2={sx(0)} y1={M.t - 8} y2={H - M.b} stroke={C.axis} strokeOpacity="0.5" strokeWidth="1.5" />
      <text x={sx(0)} y={H - M.b + 20} textAnchor="middle" fontSize="11" fontWeight="700" fill={C.axis}>secret</text>
      {shares.map((s) => (
        <text key={s.x} x={sx(s.x)} y={H - M.b + 20} textAnchor="middle" fontSize="11" fill={C.tick}>{s.x}</text>
      ))}

      <g clipPath="url(#viz-clip)">
        {k === 0 && <path d={path((x) => evalPoly(coeffs, x))} fill="none" stroke="url(#viz-curve)" strokeWidth="3" strokeLinecap="round" />}
        {family.map(({ target, f }) => (
          <g key={target}>
            <path d={path(f)} fill="none" stroke={C.family} strokeOpacity="0.32" strokeWidth="1.5" />
            <circle cx={sx(0)} cy={sy(target)} r="4" fill={C.family} opacity="0.7" />
          </g>
        ))}
        {k >= T && (
          <>
            <path d={path((x) => lagrangeAt(points, x))} fill="none" stroke={C.found} strokeWidth="8" opacity="0.3" filter="url(#viz-glow)" />
            <path d={path((x) => lagrangeAt(points, x))} fill="none" stroke={C.found} strokeWidth="3" strokeLinecap="round" />
          </>
        )}
      </g>

      {/* the secret where the curve meets x = 0 */}
      {k === 0 && (
        <rect x={sx(0) - 7} y={sy(secret) - 7} width="14" height="14" transform={`rotate(45 ${sx(0)} ${sy(secret)})`} fill={C.curveA} stroke={C.bg} strokeWidth="2" />
      )}
      {k > 0 && k < T && (
        <text x={sx(0) + 12} y={M.t + 8} fontSize="22" fontWeight="800" fill={C.family}>?</text>
      )}
      {k >= T && (
        <g>
          <circle cx={sx(0)} cy={sy(found)} r="16" fill={C.found} opacity="0.18" className="animate-breathe" />
          <circle cx={sx(0)} cy={sy(found)} r="7" fill={C.found} />
          <text x={sx(0) + 14} y={sy(found) - 12} fontSize="13" fontWeight="800" fill={C.found}>{Math.round(found)}</text>
        </g>
      )}

      {/* custodian shares */}
      {shares.map((s) => {
        const on = selected.includes(s.x)
        const dim = k > 0 && !on
        return (
          <g key={s.x} onClick={() => onToggle(s.x)} className="cursor-pointer">
            <circle cx={sx(s.x)} cy={sy(s.y)} r="18" fill="transparent" />
            {on && <circle cx={sx(s.x)} cy={sy(s.y)} r="12" fill="none" stroke={C.point} strokeWidth="2" />}
            <circle cx={sx(s.x)} cy={sy(s.y)} r="6.5" fill={dim ? C.bg : C.point} stroke={dim ? C.dim : C.point} strokeWidth="2" />
            <text x={sx(s.x)} y={sy(s.y) - 18} textAnchor="middle" fontSize="12" fontWeight="700" fill={dim ? C.tick : '#e4eeec'}>{s.role}</text>
          </g>
        )
      })}
    </svg>
  )
}
