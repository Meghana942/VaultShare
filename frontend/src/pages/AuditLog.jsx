import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, ShieldX } from 'lucide-react'
import { api } from '../lib/api'
import { formatTime } from '../lib/format'
import { Badge, Card, PageHeader, Spinner } from '../components/ui'

const EVENTS = {
  VAULT_CREATED: ['Vault created', 'sea'],
  SHARE_ACCEPTED: ['Share accepted', 'green'],
  SHARE_REJECTED: ['Share rejected', 'red'],
  SHARE_WITHDRAWN: ['Share withdrawn', 'slate'],
  SESSION_RESET: ['Reset', 'slate'],
  FORCED_RECONSTRUCTION: ['Forced attempt', 'sand'],
  UNLOCK_SUCCESS: ['Unlocked', 'green'],
  UNLOCK_FAILED: ['Unlock failed', 'red'],
  FILE_DECRYPTED: ['File opened', 'sky'],
  SHARES_REFRESHED: ['Shares refreshed', 'sky'],
  VAULT_DELETED: ['Vault deleted', 'red'],
}

function summary(action, d) {
  switch (action) {
    case 'VAULT_CREATED':
      return `${d.t} of ${d.n} · ${d.filename}`
    case 'SHARE_ACCEPTED':
    case 'SHARE_WITHDRAWN':
      return `share #${d.x}`
    case 'SHARE_REJECTED':
      return `share #${d.x} · ${d.reason?.startsWith('stale') ? 'old share' : 'fake share'}`
    case 'FORCED_RECONSTRUCTION':
      return `${d.k} share${d.k === 1 ? '' : 's'} · ${d.key_matches ? 'correct key' : 'wrong key'}`
    case 'UNLOCK_SUCCESS':
      return (d.approved_by || []).join(', ')
    case 'SHARES_REFRESHED':
      return `v${d.from_epoch} → v${d.to_epoch}`
    case 'FILE_DECRYPTED':
      return d.filename
    default:
      return ''
  }
}

export default function AuditLog() {
  const [rows, setRows] = useState(null)
  const [chain, setChain] = useState(null)
  const [vaults, setVaults] = useState([])
  const [filter, setFilter] = useState('')

  const load = useCallback(() => {
    Promise.all([api.audit(filter || undefined), api.verifyAudit(), api.listVaults()])
      .then(([r, c, v]) => {
        setRows(r)
        setChain(c)
        setVaults(v)
      })
      .catch(() => setRows([]))
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const names = Object.fromEntries(vaults.map((v) => [v.id, v.name]))

  return (
    <>
      <PageHeader
        title="Audit Log"
        actions={
          chain &&
          (chain.ok ? (
            <Badge tone="green" icon={ShieldCheck} className="!px-3 !py-1 !text-sm">Integrity verified</Badge>
          ) : (
            <Badge tone="red" icon={ShieldX} className="!px-3 !py-1 !text-sm">Tampered at entry #{chain.broken_at}</Badge>
          ))
        }
      />

      {vaults.length > 1 && (
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-4 rounded-full border border-line-strong bg-raised/80 px-4 py-2 text-sm text-ink focus:outline-none">
          <option value="">All vaults</option>
          {vaults.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      )}

      {!rows ? (
        <Spinner />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-faint">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Time</th>
                <th className="px-6 py-3.5 font-semibold">Event</th>
                <th className="px-6 py-3.5 font-semibold">By</th>
                <th className="px-6 py-3.5 font-semibold">Vault</th>
                <th className="px-6 py-3.5 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const [label, tone] = EVENTS[r.action] || [r.action, 'slate']
                return (
                  <tr key={r.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-6 py-3 whitespace-nowrap text-muted">{formatTime(r.ts)}</td>
                    <td className="px-6 py-3 whitespace-nowrap"><Badge tone={tone}>{label}</Badge></td>
                    <td className="px-6 py-3 font-semibold whitespace-nowrap text-ink">{r.actor}</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {r.vault_id && (names[r.vault_id] ? <Link to={`/vault/${r.vault_id}`} className="text-sea-300 hover:underline">{names[r.vault_id]}</Link> : <span className="text-faint">deleted</span>)}
                    </td>
                    <td className="px-6 py-3 text-muted">{summary(r.action, r.detail)}</td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-faint">No events yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}
