import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Image, KeyRound, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes, timeAgo } from '../lib/format'
import { Badge, Button, Callout, Card, PageHeader, Spinner } from '../components/ui'

function KindIcon({ vault }) {
  const [Icon, tone] = vault.mime.startsWith('image/')
    ? [Image, 'bg-sky-400/10 text-sky-300']
    : vault.kind === 'text'
      ? [KeyRound, 'bg-sand-400/10 text-sand-300']
      : [FileText, 'bg-sea-400/10 text-sea-300']
  return (
    <div className={`rounded-2xl p-3 ${tone}`}>
      <Icon size={22} />
    </div>
  )
}

export default function Dashboard() {
  const [vaults, setVaults] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.listVaults().then(setVaults).catch((e) => setError(e.message))
  }, [])

  return (
    <>
      <PageHeader
        title="Vaults"
        actions={
          <Link to="/create">
            <Button icon={Plus}>New vault</Button>
          </Link>
        }
      />

      {error && (
        <Callout tone="danger" title="Backend is not running" className="mb-6">
          Start <code className="font-mono">run-backend.cmd</code>, then refresh.
        </Callout>
      )}

      {!vaults && !error && <Spinner />}

      {vaults && vaults.length === 0 && (
        <Card className="flex flex-col items-center px-6 py-20 text-center">
          <div className="rounded-full bg-sea-400/10 p-4 text-sea-300">
            <KeyRound size={28} />
          </div>
          <h2 className="mt-5 text-xl font-bold">No vaults yet</h2>
          <Link to="/create" className="mt-6">
            <Button icon={Plus}>Create a vault</Button>
          </Link>
        </Card>
      )}

      {vaults && vaults.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {vaults.map((v) => (
            <Link key={v.id} to={`/vault/${v.id}`} className="group">
              <Card className="flex h-full items-center gap-4 p-5 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-sea-400/30">
                <KindIcon vault={v} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-lg font-bold text-ink">{v.name}</h3>
                    <Badge tone="sea">
                      {v.t} of {v.n}
                    </Badge>
                  </div>
                  <div className="mt-1 truncate text-sm text-muted">
                    {v.filename} · {formatBytes(v.size)} · {timeAgo(v.created_at)}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
