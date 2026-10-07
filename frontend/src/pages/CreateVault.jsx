import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Download, Plus, Trash2, Upload } from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes } from '../lib/format'
import { depositShares } from '../lib/wallet'
import { shortShare } from '../lib/shares'
import { Button, Callout, Card, CopyButton, PageHeader, inputClass, useToast } from '../components/ui'

const DEFAULT_ROLES = ['CEO', 'CTO', 'CFO', 'Legal Counsel', 'CISO']
const MAX_ROLES = 10

function downloadShareCard(vault, s) {
  const text = [
    'VAULTSHARE: CUSTODIAN SHARE CARD',
    '================================',
    `Vault:     ${vault.name} (${vault.id})`,
    `Custodian: ${s.role} (share #${s.x})`,
    `Version:   ${s.epoch}`,
    `Policy:    any ${vault.t} of ${vault.n} custodians can unlock`,
    '',
    s.share,
    '',
  ].join('\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `share-${vault.id}-v${s.epoch}-${s.role.replace(/\W+/g, '_')}.txt`,
  })
  a.click()
  URL.revokeObjectURL(url)
}

function Label({ children }) {
  return <div className="mb-2 text-sm font-semibold text-ink">{children}</div>
}

export default function CreateVault() {
  const toast = useToast()
  const [name, setName] = useState('')
  const [mode, setMode] = useState('file')
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [roles, setRoles] = useState(DEFAULT_ROLES)
  const [threshold, setThreshold] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [dragging, setDragging] = useState(false)

  const n = roles.length
  const t = Math.min(threshold, n)

  const setRole = (i, v) => setRoles(roles.map((r, j) => (j === i ? v : r)))
  const removeRole = (i) => {
    const next = roles.filter((_, j) => j !== i)
    setRoles(next)
    if (threshold > next.length) setThreshold(next.length)
  }

  const pickFile = (f) => {
    if (!f) return
    setFile(f)
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('threshold', String(t))
      fd.append('roles', JSON.stringify(roles))
      if (mode === 'file' && file) fd.append('file', file)
      if (mode === 'text') fd.append('text', text)
      const res = await api.createVault(fd)
      depositShares(res.vault, res.shares)
      setResult(res)
      toast('Vault created', 'success')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    const { vault, shares } = result
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title={vault.name}
          meta={<span>{vault.t} of {vault.n} approvals needed</span>}
          actions={
            <Link to={`/vault/${vault.id}`}>
              <Button icon={ArrowRight}>Open vault</Button>
            </Link>
          }
        />
        <Card>
          <div className="border-b border-line px-6 py-4 font-semibold">Shares</div>
          <ul className="divide-y divide-line">
            {shares.map((s) => (
              <li key={s.x} className="flex flex-wrap items-center gap-3 px-6 py-3.5">
                <div className="w-32 shrink-0 font-semibold text-ink">{s.role}</div>
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-faint">{shortShare(s.share, 14)}</code>
                <div className="flex gap-2">
                  <CopyButton text={s.share} />
                  <Button variant="secondary" size="sm" icon={Download} onClick={() => downloadShareCard(vault, s)}>
                    Save
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <div className="mt-6">
          <Button variant="ghost" icon={Plus} onClick={() => { setResult(null); setFile(null); setText(''); setName('') }}>
            Create another
          </Button>
        </div>
      </div>
    )
  }

  const canSubmit = name.trim() && (mode === 'file' ? file : text.trim()) && roles.every((r) => r.trim()) && n >= 2

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New vault" />
      <form onSubmit={submit}>
        <Card className="space-y-8 p-6 sm:p-8">
          <div>
            <Label>Name</Label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Board minutes" className={inputClass} />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <Label>Secret</Label>
              <div className="inline-flex rounded-full border border-line bg-raised/80 p-1 text-xs font-semibold">
                {[
                  ['file', 'File'],
                  ['text', 'Text'],
                ].map(([k, label]) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setMode(k)}
                    className={`rounded-full px-4 py-1 transition ${mode === k ? 'bg-sea-400/20 text-sea-200' : 'text-muted hover:text-ink'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {mode === 'file' ? (
              <label
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  pickFile(e.dataTransfer.files[0])
                }}
                className={`flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  dragging ? 'border-sea-400 bg-sea-400/[0.06]' : 'border-line-strong hover:border-sea-400/50 hover:bg-white/[0.02]'
                }`}
              >
                <Upload size={22} className="text-sea-300" />
                {file ? (
                  <>
                    <div className="mt-3 font-semibold text-ink">{file.name}</div>
                    <div className="text-xs text-muted">{formatBytes(file.size)}</div>
                  </>
                ) : (
                  <div className="mt-3 text-sm text-muted">Drop a file or click to browse</div>
                )}
                <input type="file" className="hidden" onChange={(e) => pickFile(e.target.files[0])} />
              </label>
            ) : (
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Type the secret…" className={`font-mono ${inputClass}`} />
            )}
          </div>

          <div>
            <Label>Custodians</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={r} onChange={(e) => setRole(i, e.target.value)} className={`min-w-0 flex-1 !py-2 ${inputClass}`} />
                  <button
                    type="button"
                    disabled={n <= 2}
                    onClick={() => removeRole(i)}
                    className="rounded-full p-2 text-faint transition hover:bg-coral-400/10 hover:text-coral-300 disabled:opacity-30"
                    aria-label={`Remove ${r}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" icon={Plus} className="mt-2" disabled={n >= MAX_ROLES} onClick={() => setRoles([...roles, `Custodian ${n + 1}`])}>
              Add
            </Button>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <Label>Approvals needed</Label>
              <span className="text-sm font-bold text-sea-300">
                {t} of {n}
              </span>
            </div>
            <input type="range" min={2} max={n} value={t} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-sea-400" />
            <div className="mt-3 flex gap-1.5">
              {roles.map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < t ? 'bg-linear-to-r from-sea-400 to-sky-400' : 'bg-white/[0.07]'}`} />
              ))}
            </div>
          </div>

          {error && <Callout tone="danger">{error}</Callout>}

          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!canSubmit}>
            Create vault
          </Button>
        </Card>
      </form>
    </div>
  )
}
