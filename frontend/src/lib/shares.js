// Share strings look like:  svs1-<vault id>-<epoch>-<x>-<y in hex>
// (same format as backend/app/share_codec.py)

export function parseShare(text) {
  const compact = (text || '').replace(/\s+/g, '').toLowerCase()
  const m = compact.match(/^svs1-([0-9a-f]+)-(\d+)-(\d+)-([0-9a-f]+)$/)
  if (!m) return null
  return { vaultId: m[1], epoch: Number(m[2]), x: Number(m[3]), yHex: m[4] }
}

export function formatShare(vaultId, epoch, x, yHex) {
  return `svs1-${vaultId}-${epoch}-${x}-${yHex}`
}

// Custodian-side proactive refresh:  y' = (y + delta(x)) mod Q.
// Runs in the custodian's wallet; the server never sees y or y'.
export function applyDelta(share, deltaHex, qHex, newEpoch) {
  const p = parseShare(share)
  const y = BigInt('0x' + p.yHex)
  const delta = BigInt('0x' + deltaHex)
  const q = BigInt('0x' + qHex)
  const y2 = (y + delta) % q
  return formatShare(p.vaultId, newEpoch, p.x, y2.toString(16).padStart(p.yHex.length, '0'))
}

// Demo helper: a "forged" share is a real one with a single hex digit changed.
export function forgeShare(share) {
  const p = parseShare(share)
  const i = p.yHex.length - 7
  const flipped = ((parseInt(p.yHex[i], 16) + 7) % 16).toString(16)
  return formatShare(p.vaultId, p.epoch, p.x, p.yHex.slice(0, i) + flipped + p.yHex.slice(i + 1))
}

export function shortShare(share, keep = 10) {
  const p = parseShare(share)
  if (!p) return share
  return `svs1-${p.vaultId}-${p.epoch}-${p.x}-${p.yHex.slice(0, keep)}…${p.yHex.slice(-keep)}`
}
