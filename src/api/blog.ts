import { API_BASE_URL } from './config'

export interface BlogPost {
  _id: string
  slug: string
  title: string
  category: string
  excerpt: string
  body: string
  image: string
  publishedAt: string
}

export type BlogPostInput = Pick<BlogPost, 'title' | 'category' | 'excerpt' | 'body' | 'image' | 'publishedAt'>

function getAuthHeader(): Record<string, string> {
  try {
    const token = localStorage.getItem('wanderworkToken')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/blog${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload?.message || `Request failed: ${res.status}`)
  return payload as T
}

export function fetchBlogPosts(): Promise<{ posts: BlogPost[]; canEdit: boolean }> {
  return request('/posts')
}

export function createBlogPost(input: BlogPostInput): Promise<BlogPost> {
  return request('/posts', { method: 'POST', body: JSON.stringify(input) })
}

export function updateBlogPost(id: string, input: BlogPostInput): Promise<BlogPost> {
  return request(`/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteBlogPost(id: string): Promise<{ message: string }> {
  return request(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
