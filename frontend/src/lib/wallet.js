// Custodian wallets, simulated in this browser's localStorage.
//
// In a real deployment each custodian keeps their own share on their own
// device, a printed card, or a hardware token. The server deliberately does
// NOT store shares, so if the wallet is cleared the shares are gone (download
// the share cards when you create a vault).
//
// Shape: { [vaultId]: { vaultName, holders: { [x]: { role, current: {share, epoch}, stale: [{share, epoch}] } } } }

import { useSyncExternalStore } from 'react'
import { applyDelta } from './shares'

const KEY = 'shamir-vault.wallets.v1'
const EVENT = 'shamir-vault:wallets'

let cache = null

function read() {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    cache = {}
  }
  return cache
}

function write(next) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable: keep in memory for this tab */
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(cb) {
  const onStorage = (e) => {
    if (e.key === KEY) {
      cache = null
      cb()
    }
  }
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}

export function useWallets() {
  return useSyncExternalStore(subscribe, read)
}

export function depositShares(vault, issued) {
  const holders = {}
  for (const s of issued) {
    holders[s.x] = { role: s.role, current: { share: s.share, epoch: s.epoch }, stale: [] }
  }
  write({ ...read(), [vault.id]: { vaultName: vault.name, holders } })
}

// Each custodian applies their delta locally; the old share is kept as "stale"
// purely so the demo can show what happens if someone tries to use it.
export function applyRefresh(vaultId, refresh) {
  const all = read()
  const w = all[vaultId]
  if (!w) return 0
  let updated = 0
  const holders = { ...w.holders }
  for (const d of refresh.deltas) {
    const h = holders[d.x]
    if (!h || h.current.epoch !== refresh.epoch - 1) continue
    const share = applyDelta(h.current.share, d.delta_hex, refresh.q_hex, refresh.epoch)
    holders[d.x] = { ...h, current: { share, epoch: refresh.epoch }, stale: [h.current, ...h.stale] }
    updated++
  }
  write({ ...all, [vaultId]: { ...w, holders } })
  return updated
}

export function removeWallet(vaultId) {
  const { [vaultId]: _, ...rest } = read()
  write(rest)
}
