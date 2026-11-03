const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

let token = null
try {
  token = sessionStorage.getItem('bs_token')
} catch {}

export const getToken = () => token
export function setToken(t) {
  token = t
  try {
    if (t) sessionStorage.setItem('bs_token', t)
    else sessionStorage.removeItem('bs_token')
  } catch {}
}

export class ApiError extends Error {
  constructor(code, status) {
    super(code)
    this.code = code
    this.status = status
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('network', 0)
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(json.error || 'server_error', res.status)
  return json
}

export const post = (path, body) => api(path, { method: 'POST', body: body || {} })
export const patch = (path, body) => api(path, { method: 'PATCH', body })
