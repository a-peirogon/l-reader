import type { Provider, ChatMessage, AppSettings, DocIndex } from '@/types'
import { retrievePages, nearbyPages } from '@/lib/pdf/intelligence'

// ─── System Prompt ───────────────────────────────────────────────────────────

interface BuildSystemOpts {
  pdfName: string
  totalPages: number
  currentPage: number
  pageText: Record<number, string>
  index: DocIndex
  settings: AppSettings
}

export function buildSystemPrompt(opts: BuildSystemOpts): string {
  const { pdfName, totalPages, currentPage, pageText, index, settings } = opts
  const lang = settings.language
  const sendTxt = settings.sendPageText

  let sys = `Eres Lectio, un asistente experto de lectura y análisis de documentos PDF. Respondes en ${lang}. Eres preciso, citas páginas cuando es relevante, y usas markdown para estructurar tus respuestas.`

  if (pdfName) {
    sys += `\n\n## Documento\nNombre: ${pdfName} | Páginas: ${totalPages} | Leyendo: p.${currentPage}`
    if (index.summary) sys += `\n${index.summary}`
  }

  if (index.sections.length) {
    const curSec = index.sections.find((s) => s.pages.includes(currentPage))
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

// ─── Message History ─────────────────────────────────────────────────────────

interface BuildMessagesOpts {
  messages: ChatMessage[]
  historySummary: string
  userText: string
  pendingSnap: { dataUrl: string; pageN: number } | null
  pageText: Record<number, string>
  index: DocIndex
  currentPage: number
  totalPages: number
  settings: AppSettings
}

type ApiMessage = { role: 'user' | 'assistant'; content: any }

export function buildApiMessages(opts: BuildMessagesOpts): ApiMessage[] {
  const {
    messages,
    historySummary,
    userText,
    pendingSnap,
    pageText,
    index,
    currentPage,
    totalPages,
    settings,
  } = opts

  // Retrieve relevant extra pages
  const relevant =
    index.ready && userText
      ? retrievePages(userText, index, currentPage, totalPages, 3)
      : nearbyPages(currentPage, totalPages, 2)

  const extraPages = relevant.filter(
    (p) => p !== currentPage && p !== currentPage - 1 && p !== currentPage + 1
  )

  // Compress history
  const KEEP_HEAD = 2
  const KEEP_TAIL = 6
  let historyMsgs: ChatMessage[]

  if (messages.length <= KEEP_HEAD + KEEP_TAIL) {
    historyMsgs = [...messages]
  } else {
    const head = messages.slice(0, KEEP_HEAD)
    const tail = messages.slice(-KEEP_TAIL)
    historyMsgs = [...head]
    if (historySummary) {
      historyMsgs.push({
        id: 'summary-user',
        role: 'user',
        type: 'text',
        content: historySummary,
        timestamp: Date.now(),
      })
      historyMsgs.push({
        id: 'summary-assistant',
        role: 'assistant',
        type: 'text',
        content: 'Entendido, tengo ese contexto previo en cuenta.',
        timestamp: Date.now(),
      })
    }
    historyMsgs.push(...tail)
  }

  // Convert history to API format
  const out: ApiMessage[] = []
  for (const m of historyMsgs) {
    if (m.type === 'system') continue
    if (m.type === 'snap') {
      out.push({
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: m.dataUrl.split(',')[1],
            },
          },
          { type: 'text', text: m.label },
        ],
      })
    } else {
      out.push({ role: m.role as 'user' | 'assistant', content: m.content })
    }
  }

  // Build current user message
  const contentParts: any[] = []

  if (pendingSnap) {
    contentParts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: pendingSnap.dataUrl.split(',')[1],
      },
    })
  }

  if (extraPages.length > 0 && settings.sendPageText) {
    const ctxBlock = extraPages
      .map((p) => `[p.${p}]\n${(pageText[p] || '').slice(0, 800)}`)
      .join('\n\n')
    contentParts.push({
      type: 'text',
      text: `<contexto_relevante>\n${ctxBlock}\n</contexto_relevante>\n\n${userText || 'Explica este fragmento.'}`,
    })
  } else {
    contentParts.push({
      type: 'text',
      text: userText || 'Explica este fragmento.',
    })
  }

  out.push({
    role: 'user',
    content:
      contentParts.length === 1 && contentParts[0].type === 'text'
        ? contentParts[0].text
        : contentParts,
  })

  return out
}

// ─── Claude API ──────────────────────────────────────────────────────────────

export async function callClaude(
  apiKey: string,
  system: string,
  messages: ApiMessage[],
  model = 'claude-sonnet-4-20250514'
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: 1800, system, messages }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.content.map((b: any) => b.text || '').join('')
}

// ─── Gemini API ──────────────────────────────────────────────────────────────

export async function callGemini(
  apiKey: string,
  system: string,
  messages: ApiMessage[],
  model = 'gemini-2.5-flash'
): Promise<string> {
  // Convert to Gemini format
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: Array.isArray(m.content)
      ? m.content.map((p: any) =>
          p.type === 'text'
            ? { text: p.text }
            : { inlineData: { mimeType: p.source.media_type, data: p.source.data } }
        )
      : [{ text: m.content }],
  }))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 1800, temperature: 0.7 },
      }),
    }
  )
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return (
    data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') ||
    '(sin respuesta)'
  )
}

// ─── Doc indexing (one-shot, cheap model) ────────────────────────────────────

export interface DocMeta {
  title: string
  type: string
  language: string
  summary: string
  themes: string[]
}

export async function buildDocSummary(
  claudeKey: string,
  geminiKey: string,
  geminiModel: string,
  sampleText: string
): Promise<DocMeta | null> {
  const prompt = `Analiza este documento y devuelve SOLO este JSON (sin markdown):
{
  "title": "título o tema principal",
  "type": "tipo de documento (paper/libro/informe/manual/otro)",
  "language": "idioma principal",
  "summary": "resumen en 2-3 oraciones",
  "themes": ["tema1","tema2","tema3"]
}

TEXTO DE MUESTRA:
${sampleText}`

  let raw = ''

  try {
    if (claudeKey) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: 'Responde SOLO con el JSON solicitado, sin texto adicional.',
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const d = await res.json()
      if (!d.error) raw = d.content.map((b: any) => b.text || '').join('').trim()
    } else if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 400 },
          }),
        }
      )
      const d = await res.json()
      if (!d.error)
        raw =
          d.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('').trim() || ''
    }

    if (!raw) return null
    return JSON.parse(raw.replace(/^```json?\n?/, '').replace(/```$/, ''))
  } catch {
    return null
  }
}
