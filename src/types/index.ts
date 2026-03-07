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

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  autoSnap: boolean
  captureQuality: 1 | 2 | 3
  sendPageText: boolean
  language: 'español' | 'inglés' | 'automático'
  geminiModel: GeminiModel
}
