// ─── Types ───────────────────────────────────────────────────────────────────

export type SearchSource = 'arxiv' | 'scholar' | 'philpapers'

export interface SearchResult {
  id: string
  title: string
  authors: string[]
  year?: number
  abstract?: string
  citationCount?: number
  categories?: string[]
  source: SearchSource
  url: string
  pdfUrl?: string
}

// ─── Config ───────────────────────────────────────────────────────────────────
// In dev: Vite proxy forwards /api → http://localhost:3001
// In prod: set VITE_API_URL to your Railway URL

const BASE = (import.meta as any).env?.VITE_API_URL ?? ''

async function apiFetch(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

// ─── arXiv ───────────────────────────────────────────────────────────────────

export async function searchArxiv(query: string, limit = 10): Promise<SearchResult[]> {
  const data = await apiFetch(`/api/search/arxiv?q=${encodeURIComponent(query)}&limit=${limit}`)
  return data.results ?? []
}

// ─── Semantic Scholar ─────────────────────────────────────────────────────────

export async function searchScholar(query: string, limit = 10): Promise<SearchResult[]> {
  const data = await apiFetch(`/api/search/scholar?q=${encodeURIComponent(query)}&limit=${limit}`)
  return data.results ?? []
}

// ─── PhilPapers (link-only, no API) ──────────────────────────────────────────

export function philPapersUrl(query: string): string {
  return `https://philpapers.org/s/${encodeURIComponent(query)}`
}
