import { invoke } from '@tauri-apps/api/core'
import type { Provider, ChatMessage, AppSettings, DocIndex } from '@/types'
import { retrievePages, nearbyPages } from '@/lib/pdf/intelligence'

// ─── System Prompt ────────────────────────────────────────────────────────────

interface BuildSystemOpts {
  pdfName:     string
  totalPages:  number
  currentPage: number
  pageText:    Record<number, string>
  index:       DocIndex
  settings:    AppSettings
}

export function buildSystemPrompt(opts: BuildSystemOpts): string {
  const { pdfName, totalPages, currentPage, pageText, index, settings } = opts
  const lang    = settings.language
  const sendTxt = settings.sendPageText

  let sys = `Eres Lectio, un asistente experto de lectura y análisis de documentos PDF. Respondes en ${lang}. Eres preciso, citas páginas cuando es relevante, y usas markdown para estructurar tus respuestas.`

  if (pdfName) {
    sys += `\n\n## Documento\nNombre: ${pdfName} | Páginas: ${totalPages} | Leyendo: p.${currentPage}`
    if (index.summary) sys += `\n${index.summary}`
  }

  if (index.sections.length) {
    const curSec = index.sections.find(s => s.pages.includes(currentPage))
    if (curSec) {
      sys += `\n\n## Sección actual\n"${curSec.heading}" (pp. ${curSec.pages[0]}–${curSec.pages[curSec.pages.length - 1]})`
      if (curSec.keywords.length) sys += `\nConceptos clave: ${curSec.keywords.join(', ')}`
    }
  }

  if (sendTxt && pageText[currentPage]) {
    const prev = pageText[currentPage - 1]
    const curr = pageText[currentPage]
    const next = pageText[currentPage + 1]
    sys += `\n\n## Texto en pantalla`
    if (prev) sys += `\n\n[p.${currentPage - 1} — final]\n${prev.slice(-400)}`
    sys += `\n\n[p.${currentPage}]\n${curr.slice(0, 2800)}`
    if (next) sys += `\n\n[p.${currentPage + 1} — inicio]\n${next.slice(0, 400)}`
  }

  sys += `\n\n## Instrucciones\n- Cita páginas específicas cuando respondas.\n- Si la respuesta está en el texto proporcionado, úsalo directamente.\n- Si necesitas páginas no incluidas, indícalo.\n- Sé conciso pero completo.`
  return sys
}

// ─── Message History ──────────────────────────────────────────────────────────

interface BuildMessagesOpts {
  messages:       ChatMessage[]
  historySummary: string
  userText:       string
  pendingSnap:    { dataUrl: string; pageN: number } | null
  pageText:       Record<number, string>
  index:          DocIndex
  currentPage:    number
  totalPages:     number
  settings:       AppSettings
}

type ApiMessage = { role: 'user' | 'assistant'; content: any }

export function buildApiMessages(opts: BuildMessagesOpts): ApiMessage[] {
  const { messages, historySummary, userText, pendingSnap, pageText, index, currentPage, totalPages, settings } = opts

  const relevant = index.ready && userText
    ? retrievePages(userText, index, currentPage, totalPages, 3)
    : nearbyPages(currentPage, totalPages, 2)

  const extraPages = relevant.filter(p => p !== currentPage && p !== currentPage - 1 && p !== currentPage + 1)

  const KEEP_HEAD = 2, KEEP_TAIL = 6
  let historyMsgs: ChatMessage[]

  if (messages.length <= KEEP_HEAD + KEEP_TAIL) {
    historyMsgs = [...messages]
  } else {
    const head = messages.slice(0, KEEP_HEAD)
    const tail = messages.slice(-KEEP_TAIL)
    historyMsgs = [...head]
    if (historySummary) {
      historyMsgs.push({ id: 'summary-user', role: 'user', type: 'text', content: historySummary, timestamp: Date.now() })
      historyMsgs.push({ id: 'summary-assistant', role: 'assistant', type: 'text', content: 'Entendido, tengo ese contexto previo en cuenta.', timestamp: Date.now() })
    }
    historyMsgs.push(...tail)
  }

  const out: ApiMessage[] = []
  for (const m of historyMsgs) {
    if (m.type === 'system') continue
    if (m.type === 'snap') {
      out.push({
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: m.dataUrl.split(',')[1] } },
          { type: 'text', text: m.label },
        ],
      })
    } else {
      out.push({ role: m.role as 'user' | 'assistant', content: m.content })
    }
  }

  const contentParts: any[] = []
  if (pendingSnap) {
    contentParts.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: pendingSnap.dataUrl.split(',')[1] } })
  }

  if (extraPages.length > 0 && settings.sendPageText) {
    const ctxBlock = extraPages.map(p => `[p.${p}]\n${(pageText[p] || '').slice(0, 800)}`).join('\n\n')
    contentParts.push({ type: 'text', text: `<contexto_relevante>\n${ctxBlock}\n</contexto_relevante>\n\n${userText || 'Explica este fragmento.'}` })
  } else {
    contentParts.push({ type: 'text', text: userText || 'Explica este fragmento.' })
  }

  out.push({
    role: 'user',
    content: contentParts.length === 1 && contentParts[0].type === 'text' ? contentParts[0].text : contentParts,
  })

  return out
}

// ─── Claude (via Tauri) ───────────────────────────────────────────────────────

export async function callClaude(
  apiKey:   string,
  system:   string,
  messages: ApiMessage[],
  model = 'claude-sonnet-4-20250514',
): Promise<string> {
  return invoke<string>('call_claude', { apiKey, system, messages, model })
}

// ─── Gemini (via Tauri) ───────────────────────────────────────────────────────

export async function callGemini(
  apiKey:   string,
  system:   string,
  messages: ApiMessage[],
  model = 'gemini-2.5-flash',
): Promise<string> {
  return invoke<string>('call_gemini', { apiKey, system, messages, model })
}

// ─── Doc summary (via Tauri) ──────────────────────────────────────────────────

export interface DocMeta {
  title:    string
  type:     string
  language: string
  summary:  string
  themes:   string[]
}

export async function buildDocSummary(
  claudeKey:   string,
  geminiKey:   string,
  geminiModel: string,
  sampleText:  string,
): Promise<DocMeta | null> {
  try {
    const result = await invoke<DocMeta | null>('build_doc_summary', {
      claudeKey,
      geminiKey,
      geminiModel,
      sampleText,
    })
    return result
  } catch (err) {
    console.error('[buildDocSummary]', err)
    return null
  }
}
