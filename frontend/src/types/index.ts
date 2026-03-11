// ─── AI Providers ────────────────────────────────────────────────────────────

export type Provider = 'claude' | 'gemini'

export type GeminiModel =
| 'gemini-2.5-flash'
| 'gemini-2.5-flash-lite'
| 'gemini-2.5-pro'
| 'gemini-2.0-flash'

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface TextMessage {
  id: string
  role: 'user' | 'assistant'
  type: 'text'
  content: string
  timestamp: number
}

export interface SnapMessage {
  id: string
  role: 'user'
  type: 'snap'
  dataUrl: string
  pageN: number
  label: string
  timestamp: number
}

export interface SystemNote {
  id: string
  type: 'system'
  content: string
  timestamp: number
}

export type ChatMessage = TextMessage | SnapMessage | SystemNote

// ─── PDF / Document ──────────────────────────────────────────────────────────

export interface DocSection {
  pages: number[]
  heading: string
  snippet: string
  keywords: string[]
}

export interface DocIndex {
  ready: boolean
  sections: DocSection[]
  summary: string
  themes: string[]
  tfidf: Record<string, Record<number, number>>
}

// ─── ArXiv / Paper Intelligence ──────────────────────────────────────────────

export interface ArxivMeta {
  id: string            // e.g. "2301.12345"
  title: string
  authors: string[]
  abstract: string
  categories: string[]  // e.g. ["cs.LG", "cs.AI"]
  published: string     // ISO date
  updated: string
  link: string          // https://arxiv.org/abs/ID
}

export interface Reference {
  index: number
  text: string          // raw reference text
  arxivId?: string
  doi?: string
}

export interface RelatedPaper {
  title: string
  authors: string[]
  year: number
  arxivId?: string
  paperId: string       // Semantic Scholar ID
}

export type FetchStatus = 'idle' | 'loading' | 'ok' | 'none' | 'error'

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  autoSnap: boolean
  captureQuality: 1 | 2 | 3
  sendPageText: boolean
  language: 'español' | 'inglés' | 'automático'
  geminiModel: GeminiModel
}
