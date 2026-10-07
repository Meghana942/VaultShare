// Thin wrapper around the FastAPI backend (proxied at /api by Vite).

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, options)
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') message = body.detail
      else if (Array.isArray(body.detail)) message = body.detail.map((d) => d.msg).join('; ')
    } catch {
      /* not JSON */
    }
    throw new Error(message || `Request failed (${res.status})`)
  }
  return res.json()
}

const postJson = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body ?? {}),
})

export const api = {
  params: () => request('/params'),
  listVaults: () => request('/vaults'),
  getVault: (id) => request(`/vaults/${id}`),
  createVault: (formData) => request('/vaults', { method: 'POST', body: formData }),
  deleteVault: (id) => request(`/vaults/${id}`, { method: 'DELETE' }),
  submitShare: (id, share) => request(`/vaults/${id}/shares`, postJson({ share })),
  withdrawShare: (id, x) => request(`/vaults/${id}/shares/${x}`, { method: 'DELETE' }),
  resetRoom: (id) => request(`/vaults/${id}/reset`, postJson()),
  force: (id, xs) => request(`/vaults/${id}/force`, postJson({ xs })),
  unlock: (id) => request(`/vaults/${id}/unlock`, postJson()),
  refresh: (id) => request(`/vaults/${id}/refresh`, postJson()),
  audit: (vaultId) => request(`/audit${vaultId ? `?vault_id=${encodeURIComponent(vaultId)}` : ''}`),
  verifyAudit: () => request('/audit/verify'),

  async download(id, token) {
    const res = await fetch(`/api/vaults/${id}/download?token=${encodeURIComponent(token)}`)
    if (!res.ok) throw new Error('Download link expired: unlock the vault again')
    return res.blob()
  },
}
