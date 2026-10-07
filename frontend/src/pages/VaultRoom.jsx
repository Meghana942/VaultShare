import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleCheck, CircleX, Download, KeyRound, LockOpen, RefreshCw, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { api } from '../lib/api'
import { base64ToBytes, formatBytes, toHex } from '../lib/format'
import { applyRefresh, removeWallet, useWallets } from '../lib/wallet'
import { forgeShare } from '../lib/shares'
import { ByteCanvas } from '../components/Bytes'
import { Badge, Button, Callout, Card, PageHeader, ShareMeter, Spinner, inputClass, useToast } from '../components/ui'

export default function VaultRoom() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const wallets = useWallets()
  const wallet = wallets[id]

  const [vault, setVault] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [forced, setForced] = useState(null)
  const [unlocked, setUnlocked] = useState(null)

  const load = useCallback(async () => {
    try {
      setVault(await api.getVault(id))
    } catch (e) {
      setError(e.message)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const run = async (key, fn) => {
    setBusy(key)
    try {
      return await fn()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const setSession = (session) => setVault((v) => ({ ...v, session }))

  const submit = (shareText, label) =>
    run(`submit-${label}`, async () => {
      setSession(await api.submitShare(id, shareText))
      setUnlocked(null)
    })

  const withdraw = (x) => run(`withdraw-${x}`, async () => setSession(await api.withdrawShare(id, x)))

  const submitted = vault?.session.submitted ?? []

  const force = () =>
    run('force', async () => {
      setForced(await api.force(id))
      setUnlocked(null)
      setSession((await api.getVault(id)).session)
    })

  const unlock = () =>
    run('unlock', async () => {
      const result = await api.unlock(id)
      const blob = await api.download(id, result.download_token)
      const text = result.mime.startsWith('text/') ? await blob.text() : null
      setUnlocked({ ...result, url: URL.createObjectURL(blob), text })
      setForced(null)
      setSession((await api.getVault(id)).session)
    })

  useEffect(() => () => unlocked?.url && URL.revokeObjectURL(unlocked.url), [unlocked])

  const reset = () =>
    run('reset', async () => {
      setSession(await api.resetRoom(id))
      setForced(null)
    })

  const refresh = () => {
    if (!window.confirm('Refresh all shares? Old shares will stop working.')) return
    run('refresh', async () => {
      const r = await api.refresh(id)
      applyRefresh(id, r)
      setForced(null)
      setUnlocked(null)
      await load()
      toast(`Shares refreshed (version ${r.epoch})`, 'success')
    })
  }

  const remove = () => {
    if (!window.confirm(`Delete "${vault.name}"?`)) return
    run('delete', async () => {
      await api.deleteVault(id)
      removeWallet(id)
      navigate('/vaults')
    })
  }

  if (error) return <Callout tone="danger" title="Could not load vault">{error}</Callout>
  if (!vault) return <Spinner />

  const s = vault.session
  return (
    <>
      <Link to="/vaults" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={15} /> Vaults
      </Link>
      <PageHeader
        title={vault.name}
        meta={
          <>
            <span>{vault.filename} · {formatBytes(vault.size)}</span>
            <Badge tone="sea">{vault.t} of {vault.n}</Badge>
            <Badge tone="sky">shares v{vault.epoch}</Badge>
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} loading={busy === 'refresh'} onClick={refresh}>Refresh shares</Button>
            <Button variant="ghost" icon={Trash2} onClick={remove} aria-label="Delete vault" />
          </>
        }
      />

      <Card className="flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center">
        <div className="flex-1">
          <ShareMeter verified={s.verified_count} threshold={vault.t} />
        </div>
        <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-stretch">
          <Button variant="success" size="lg" icon={LockOpen} disabled={!s.ready} loading={busy === 'unlock'} onClick={unlock}>
            Unlock
          </Button>
          <Button variant="danger" disabled={!submitted.length} loading={busy === 'force'} onClick={force}>
            Force reconstruct
          </Button>
          <Button variant="ghost" size="sm" icon={RotateCcw} loading={busy === 'reset'} onClick={reset} disabled={!submitted.length}>
            Reset
          </Button>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {vault.roles.map((role, i) => (
          <CustodianCard
            key={i}
            x={i + 1}
            role={role}
            vaultEpoch={vault.epoch}
            submission={submitted.find((sh) => sh.x === i + 1)}
            holder={wallet?.holders[i + 1]}
            onSubmit={submit}
            onWithdraw={() => withdraw(i + 1)}
            busy={busy}
          />
        ))}
      </div>

      {forced && <ForcedResult result={forced} vault={vault} />}
      {unlocked && <UnlockResult result={unlocked} />}
    </>
  )
}

function CustodianCard({ x, role, vaultEpoch, submission, holder, onSubmit, onWithdraw, busy }) {
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const current = holder?.current
  const old = holder?.stale?.[0]

  let status = <span className="text-faint">Waiting</span>
  let frame = 'border-line bg-panel/70'
  if (submission?.verified) {
    status = <span className="inline-flex items-center gap-1 text-mint-300"><CircleCheck size={14} /> Approved</span>
    frame = 'border-mint-400/60 bg-mint-400/[0.06]'
  } else if (submission) {
    status = (
      <span className="inline-flex items-center gap-1 text-coral-300">
        <CircleX size={14} /> {submission.share_epoch !== vaultEpoch ? 'Old share' : 'Fake share'}
      </span>
    )
    frame = 'border-coral-400/60 bg-coral-400/[0.06]'
  }

  return (
    <div className={`flex flex-col rounded-3xl border p-4 transition-colors duration-500 ${frame}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-sea-400/20 to-sky-400/20 text-xs font-bold text-sea-200">
          {role.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate font-bold text-ink">{role}</div>
          <div className="text-xs font-medium">{status}</div>
        </div>
      </div>

      <div className="mt-4 flex-1">
        {!submission && current && current.epoch === vaultEpoch && (
          <Button size="sm" icon={KeyRound} className="w-full" loading={busy === `submit-${x}-cur`} onClick={() => onSubmit(current.share, `${x}-cur`)}>
            Approve
          </Button>
        )}
        {submission && (
          <Button size="sm" variant="secondary" icon={Undo2} className="w-full" loading={busy === `withdraw-${x}`} onClick={onWithdraw}>
            Withdraw
          </Button>
        )}
      </div>

      {!submission && (
        <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs font-medium">
          {current && (
            <button onClick={() => onSubmit(forgeShare(current.share), `${x}-forge`)} className="text-coral-300/80 hover:text-coral-300">
              fake share
            </button>
          )}
          {old && (
            <button onClick={() => onSubmit(old.share, `${x}-old`)} className="text-sand-300/80 hover:text-sand-300">
              old share
            </button>
          )}
          {!current && (
            <button onClick={() => setPasting(!pasting)} className="text-muted hover:text-ink">
              paste share
            </button>
          )}
        </div>
      )}
      {pasting && !submission && (
        <div className="mt-2 space-y-2">
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={3} placeholder="svs1-…" className={`font-mono !text-[11px] ${inputClass}`} />
          <Button size="sm" className="w-full" disabled={!pasted.trim()} onClick={() => onSubmit(pasted, `${x}-paste`)}>
            Submit
          </Button>
        </div>
      )}
    </div>
  )
}

function Fact({ label, value, bad }) {
  return (
    <div className="rounded-2xl border border-line bg-raised/50 px-4 py-3">
      <div className="text-xs font-medium text-faint">{label}</div>
      <div className={`mt-1 font-semibold ${bad ? 'text-coral-300' : 'text-mint-300'}`}>{value}</div>
    </div>
  )
}

function ForcedResult({ result, vault }) {
  const bytes = useMemo(() => (result.peek_b64 ? base64ToBytes(result.peek_b64) : new Uint8Array()), [result])

  if (result.match) {
    return <Callout tone="success" title="These shares rebuild the real key, so use Unlock" className="mt-6" />
  }

  const isText = vault.mime.startsWith('text/')
  return (
    <Card className="mt-6 animate-rise border-coral-400/40 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CircleX size={26} className="text-coral-300" />
          <div>
            <h2 className="text-xl font-bold text-ink">Wrong key</h2>
            <div className="text-sm text-muted">
              {result.k} share{result.k === 1 ? '' : 's'} used · {result.t} needed
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {result.mixed_epochs && <Badge tone="sand">old + new shares</Badge>}
          {result.unverified_used > 0 && !result.mixed_epochs && <Badge tone="red">includes a rejected share</Badge>}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Fact label="Recovered value" value={`${result.value_bits}-bit number (key is 256-bit)`} bad />
        <Fact label="Key check" value="Does not match" bad />
        <Fact label="Decryption" value="Failed" bad />
      </div>

      <div className="mt-6">
        <div className="mb-2 text-xs font-medium text-faint">What the file turns into with this key</div>
        {isText ? (
          <div className="break-anywhere rounded-2xl bg-black/30 p-4 font-mono text-sm text-coral-200/80">
            {new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 160))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <ByteCanvas bytes={bytes.slice(0, 96 * 24)} width={96} scale={3} />
            <code className="font-mono text-xs text-faint">{toHex(bytes.slice(0, 12))} …</code>
          </div>
        )}
      </div>
    </Card>
  )
}

function UnlockResult({ result }) {
  const isImage = result.mime.startsWith('image/')
  const isPdf = result.mime.startsWith('application/pdf')
  return (
    <Card className="mt-6 animate-rise border-mint-400/40 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CircleCheck size={26} className="text-mint-300" />
          <div>
            <h2 className="text-xl font-bold text-ink">Vault opened</h2>
            <div className="text-sm text-muted">Approved by {result.approved_by.join(', ')}</div>
          </div>
        </div>
        <a href={result.url} download={result.filename}>
          <Button variant="success" icon={Download}>Download</Button>
        </a>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Fact label="Key check" value="Matches" />
        <Fact label="Feldman check" value={result.commitment_check ? 'Passed' : 'Failed'} bad={!result.commitment_check} />
        <Fact label="File" value="Intact" />
      </div>

      {result.forced_comparison.length > 0 && (
        <div className="mt-6 space-y-2">
          {result.forced_comparison.map((c) => {
            const pct = (c.differing_bits / c.total_bits) * 100
            return (
              <div key={c.id} className="rounded-2xl border border-line bg-raised/50 px-4 py-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted">
                    Earlier forced attempt · {c.k} share{c.k === 1 ? '' : 's'}
                    {c.mixed_epochs ? ' (old + new)' : ''}
                  </span>
                  <span className="font-semibold text-coral-300">
                    {c.differing_bits} of {c.total_bits} bits wrong
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-coral-400/80" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-black/20">
        {isImage && <img src={result.url} alt={result.filename} className="mx-auto max-h-[480px] object-contain" />}
        {isPdf && <iframe title="pdf" src={result.url} className="h-[520px] w-full bg-white" />}
        {result.text != null && <pre className="break-anywhere p-5 font-mono text-sm whitespace-pre-wrap text-ink">{result.text}</pre>}
        {!isImage && !isPdf && result.text == null && <div className="p-6 text-sm text-muted">{result.filename}</div>}
      </div>
    </Card>
  )
}
