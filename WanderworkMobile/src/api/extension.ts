import { API_BASE_URL } from './config'

function getAuthHeader(): Record<string, string> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('wanderworkToken') : null
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

export async function getExtensionKey(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/extension/key`, {
    headers: { ...getAuthHeader() },
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j?.message || `Failed to fetch extension key (${res.status})`)
  }
  const { extensionKey } = await res.json()
  return extensionKey
}

export async function regenerateExtensionKey(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/extension/key/regenerate`, {
    method: 'POST',
    headers: { ...getAuthHeader() },
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j?.message || `Failed to regenerate key (${res.status})`)
  }
  const { extensionKey } = await res.json()
  return extensionKey
}
