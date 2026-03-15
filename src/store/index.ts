import { create } from 'zustand'
import type {
  Provider,
  ChatMessage,
  DocIndex,
  AppSettings,
  GeminiModel,
  Annotation,
  AnnotationTool,
  AnnotationColor,
} from '@/types'

// ─── PDF State ───────────────────────────────────────────────────────────────

interface PdfState {
  doc: any | null
  name: string
  currentPage: number
  totalPages: number
  scale: number
  text: Record<number, string>
  index: DocIndex
  snapActive: boolean
  pendingSnap: { dataUrl: string; pageN: number } | null
}

// ─── Chat State ──────────────────────────────────────────────────────────────

interface ChatState {
  messages: ChatMessage[]
  historySummary: string
  busy: boolean
  provider: Provider
  apiKeys: { claude: string; gemini: string }
}

// ─── Annotation State ─────────────────────────────────────────────────────────

interface AnnotationsState {
  tool: AnnotationTool
  color: AnnotationColor
  strokeWidth: number
  // keyed by docId (sanitised filename)
  byDoc: Record<string, Annotation[]>
}

// ─── Full Store ──────────────────────────────────────────────────────────────

interface LectioStore {
  // PDF
  pdf: PdfState
  setPdfDoc: (doc: any, name: string, totalPages: number) => void
  setPdfPage: (page: number) => void
  setPdfScale: (scale: number) => void
  setPdfText: (page: number, text: string) => void
  setPdfIndex: (index: Partial<DocIndex>) => void
  setSnapActive: (active: boolean) => void
  setPendingSnap: (snap: { dataUrl: string; pageN: number } | null) => void
  resetPdf: () => void

  // Chat
  chat: ChatState
  addMessage: (msg: ChatMessage) => void
  clearChat: () => void
  setBusy: (busy: boolean) => void
  setProvider: (provider: Provider) => void
  setApiKey: (provider: Provider, key: string) => void
  setHistorySummary: (summary: string) => void

  // Settings
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void

  // Annotations
  annotations: AnnotationsState
  setAnnotationTool: (tool: AnnotationTool) => void
  setAnnotationColor: (color: AnnotationColor) => void
  setAnnotationStrokeWidth: (w: number) => void
  addAnnotation: (docId: string, ann: Annotation) => void
  updateAnnotation: (docId: string, id: string, patch: Partial<Annotation>) => void
  deleteAnnotation: (docId: string, id: string) => void
  setDocAnnotations: (docId: string, anns: Annotation[]) => void

  // UI
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

const DEFAULT_INDEX: DocIndex = {
  ready: false,
  sections: [],
  summary: '',
  themes: [],
  tfidf: {},
}

const DEFAULT_SETTINGS: AppSettings = {
  autoSnap: true,
  captureQuality: 2,
  sendPageText: true,
  language: 'español',
  geminiModel: 'gemini-2.5-flash',
}

const DEFAULT_ANNOTATIONS: AnnotationsState = {
  tool: 'none',
  color: '#FFD60A',
  strokeWidth: 3,
  byDoc: {},
}

export const useLectioStore = create<LectioStore>((set) => ({
  // ── PDF ──────────────────────────────────────────────────
  pdf: {
    doc: null,
    name: '',
    currentPage: 1,
    totalPages: 0,
    scale: 1.3,
    text: {},
    index: DEFAULT_INDEX,
    snapActive: false,
    pendingSnap: null,
  },

  setPdfDoc: (doc, name, totalPages) =>
    set((s) => ({ pdf: { ...s.pdf, doc, name, totalPages, currentPage: 1 } })),

  setPdfPage: (page) =>
    set((s) => ({ pdf: { ...s.pdf, currentPage: page } })),

  setPdfScale: (scale) =>
    set((s) => ({ pdf: { ...s.pdf, scale } })),

  setPdfText: (page, text) =>
    set((s) => ({ pdf: { ...s.pdf, text: { ...s.pdf.text, [page]: text } } })),

  setPdfIndex: (patch) =>
    set((s) => ({ pdf: { ...s.pdf, index: { ...s.pdf.index, ...patch } } })),

  setSnapActive: (snapActive) =>
    set((s) => ({ pdf: { ...s.pdf, snapActive } })),

  setPendingSnap: (pendingSnap) =>
    set((s) => ({ pdf: { ...s.pdf, pendingSnap } })),

  resetPdf: () =>
    set((s) => ({
      pdf: {
        ...s.pdf,
        doc: null,
        name: '',
        currentPage: 1,
        totalPages: 0,
        text: {},
        index: DEFAULT_INDEX,
        snapActive: false,
        pendingSnap: null,
      },
      chat: {
        ...s.chat,
        messages: [],
        historySummary: '',
      },
    })),

  // ── Chat ─────────────────────────────────────────────────
  chat: {
    messages: [],
    historySummary: '',
    busy: false,
    provider: 'claude',
    apiKeys: { claude: '', gemini: '' },
  },

  addMessage: (msg) =>
    set((s) => ({ chat: { ...s.chat, messages: [...s.chat.messages, msg] } })),

  clearChat: () =>
    set((s) => ({ chat: { ...s.chat, messages: [], historySummary: '' } })),

  setBusy: (busy) => set((s) => ({ chat: { ...s.chat, busy } })),

  setProvider: (provider) =>
    set((s) => ({ chat: { ...s.chat, provider } })),

  setApiKey: (provider, key) =>
    set((s) => ({
      chat: { ...s.chat, apiKeys: { ...s.chat.apiKeys, [provider]: key } },
    })),

  setHistorySummary: (historySummary) =>
    set((s) => ({ chat: { ...s.chat, historySummary } })),

  // ── Settings ─────────────────────────────────────────────
  settings: DEFAULT_SETTINGS,

  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  // ── Annotations ──────────────────────────────────────────
  annotations: DEFAULT_ANNOTATIONS,

  setAnnotationTool: (tool) =>
    set((s) => ({ annotations: { ...s.annotations, tool } })),

  setAnnotationColor: (color) =>
    set((s) => ({ annotations: { ...s.annotations, color } })),

  setAnnotationStrokeWidth: (strokeWidth) =>
    set((s) => ({ annotations: { ...s.annotations, strokeWidth } })),

  addAnnotation: (docId, ann) =>
    set((s) => ({
      annotations: {
        ...s.annotations,
        byDoc: {
          ...s.annotations.byDoc,
          [docId]: [...(s.annotations.byDoc[docId] ?? []), ann],
        },
      },
    })),

  updateAnnotation: (docId, id, patch) =>
    set((s) => ({
      annotations: {
        ...s.annotations,
        byDoc: {
          ...s.annotations.byDoc,
          [docId]: (s.annotations.byDoc[docId] ?? []).map((a) =>
            a.id === id ? ({ ...a, ...patch } as Annotation) : a
          ),
        },
      },
    })),

  deleteAnnotation: (docId, id) =>
    set((s) => ({
      annotations: {
        ...s.annotations,
        byDoc: {
          ...s.annotations.byDoc,
          [docId]: (s.annotations.byDoc[docId] ?? []).filter((a) => a.id !== id),
        },
      },
    })),

  setDocAnnotations: (docId, anns) =>
    set((s) => ({
      annotations: {
        ...s.annotations,
        byDoc: { ...s.annotations.byDoc, [docId]: anns },
      },
    })),

  // ── UI ───────────────────────────────────────────────────
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}))
