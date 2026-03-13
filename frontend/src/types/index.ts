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
  id: string
  title: string
  authors: string[]
  abstract: string
  categories: string[]
  published: string
  updated: string
  link: string
}

export interface Reference {
  index: number
  text: string
  arxivId?: string
  doi?: string
}

export interface RelatedPaper {
  title: string
  authors: string[]
  year: number
  arxivId?: string
  paperId: string
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

// ─── Annotations ─────────────────────────────────────────────────────────────

export type AnnotationTool = 'none' | 'highlight' | 'underline' | 'text' | 'draw' | 'note'

export type AnnotationColor =
| '#FFD60A'
| '#30D158'
| '#FF6369'
| '#64D2FF'
| '#BF5AF2'

export interface AnnotationBase {
  id: string
  page: number
  color: AnnotationColor
  createdAt: number
}

export interface HighlightAnnotation extends AnnotationBase {
  type: 'highlight' | 'underline'
  x: number
  y: number
  width: number
  height: number
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text'
  x: number
  y: number
  text: string
  fontSize: number
}

export interface DrawAnnotation extends AnnotationBase {
  type: 'draw'
  points: [number, number][]
  strokeWidth: number
}

export interface NoteAnnotation extends AnnotationBase {
  type: 'note'
  x: number
  y: number
  text: string
}

export type Annotation =
| HighlightAnnotation
| TextAnnotation
| DrawAnnotation
| NoteAnnotation
