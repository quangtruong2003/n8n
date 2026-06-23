function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('spa_token') : null
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export const api = {
  get: async (url: string) => {
    const res = await fetch(url, { headers: getAuthHeaders() })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lỗi server')
    return res.json()
  },
  post: async (url: string, body: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lỗi server')
    return res.json()
  },
  put: async (url: string, body: unknown) => {
    const res = await fetch(url, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(body) })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lỗi server')
    return res.json()
  },
  patch: async (url: string, body: unknown) => {
    const res = await fetch(url, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(body) })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lỗi server')
    return res.json()
  },
  delete: async (url: string) => {
    const res = await fetch(url, { method: 'DELETE', headers: getAuthHeaders() })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lỗi server')
    return res.json()
  },
}
