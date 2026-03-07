import { useCallback, useRef } from 'react'
import { useLectioStore } from '@/store'
import { buildTFIDF, detectSections } from '@/lib/pdf/intelligence'
import { buildDocSummary } from '@/lib/ai'

// ── pdfjs singleton ───────────────────────────────────────────────────────────
// Dynamic import keeps pdfjs out of the main bundle (it's ~3 MB).
// vite.config.ts must NOT exclude pdfjs-dist from optimizeDeps — when it is
// excluded Vite serves raw ESM where GlobalWorkerOptions is not exported,
// causing a crash. With pre-bundling enabled, Vite wraps the module so that
// both the default export and named interop aliases work correctly.
let pdfjsLib: any = null

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib

    const mod = await import('pdfjs-dist')
    // Vite's pre-bundler exposes the API at the top level AND under .default;
    // prefer the top level, fall back to .default for edge cases.
    pdfjsLib = mod.default ?? mod

    pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    return pdfjsLib
}

// ── Pure render helpers ───────────────────────────────────────────────────────
function renderTextSpans(tc: any, container: HTMLElement, vp: any, scale: number) {
  for (const item of tc.items) {
    if (!item.str?.trim()) continue
      const span = document.createElement('span')
      span.textContent = item.str + (item.hasEOL ? ' ' : '')
      const [a, b, , , e, f] = item.transform
      const angle = Math.atan2(b, a)
      const fontSize = Math.sqrt(a * a + b * b) * scale
      span.style.cssText = [
        'color:transparent',
        'position:absolute',
        'white-space:pre',
        'cursor:text',
        'transform-origin:0% 0%',
        'user-select:text',
        `left:${e * scale}px`,
        `top:${vp.height - f * scale - fontSize}px`,
        `font-size:${fontSize}px`,
        `transform:rotate(${angle}rad)`,
      ].join(';')
      container.appendChild(span)
  }
}

async function renderPage(doc: any, n: number, scale: number, container: HTMLElement) {
  const page = await doc.getPage(n)
  const vp = page.getViewport({ scale })

  container.querySelector(`#pw-${n}`)?.remove()

  const wrap = document.createElement('div')
  wrap.id = `pw-${n}`
  wrap.className = 'page-wrap'
  Object.assign(wrap.style, {
    position: 'relative',
    flexShrink: '0',
    width: vp.width + 'px',
    height: vp.height + 'px',
    background: '#000',
    borderRadius: '3px',
    boxShadow: '0 4px 32px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.04)',
                marginBottom: '20px',
  })

  const badge = document.createElement('div')
  badge.textContent = `p. ${n}`
  badge.style.cssText =
  'position:absolute;top:-19px;left:0;font-size:10px;font-family:"IBM Plex Mono",monospace;color:#333;letter-spacing:.05em;'

  const canvas = document.createElement('canvas')
  canvas.width = vp.width
  canvas.height = vp.height
  canvas.dataset.page = String(n)
  canvas.style.cssText = 'display:block;filter:invert(1);'
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise

  const textLayer = document.createElement('div')
  textLayer.id = `tl-${n}`
  textLayer.style.cssText =
  'position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;line-height:1;z-index:2;pointer-events:none;'
  try {
    const tc = await page.getTextContent()
    renderTextSpans(tc, textLayer, vp, scale)
  } catch (_) {}

  wrap.append(badge, canvas, textLayer)
  container.appendChild(wrap)

  wrap.style.opacity = '0'
  wrap.style.transform = 'translateY(12px)'
  wrap.style.transition = 'opacity 0.3s ease, transform 0.3s ease'
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      wrap.style.opacity = '1'
      wrap.style.transform = 'translateY(0)'
    })
  })
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function usePdf() {
  const store = useLectioStore()
  const containerRef = useRef<HTMLElement | null>(null)

  const setContainer = useCallback((el: HTMLElement | null) => {
    containerRef.current = el
  }, [])

  const loadFile = useCallback(async (file: File) => {
    const container = containerRef.current
    if (!container) {
      console.error('[usePdf] loadFile called but containerRef is null')
      return
    }

    store.resetPdf()
    container.querySelectorAll('.page-wrap').forEach((el) => el.remove())

    const lib = await getPdfJs()
    const buffer = await file.arrayBuffer()

    let doc: any
    try {
      doc = await lib.getDocument({ data: new Uint8Array(buffer) }).promise
    } catch (err) {
      console.error('[usePdf] getDocument failed:', err)
      store.addMessage({
        id: `sys-err-${Date.now()}`,
                       type: 'system',
                       content: `❌ No se pudo abrir "${file.name}": ${(err as Error).message}`,
                       timestamp: Date.now(),
      })
      return
    }

    const scale = 1.3
    store.setPdfDoc(doc, file.name, doc.numPages)

    for (let i = 1; i <= Math.min(doc.numPages, 50); i++) {
      try {
        await renderPage(doc, i, scale, container)
      } catch (err) {
        console.warn(`[usePdf] renderPage ${i} failed:`, err)
      }
    }

    const texts: Record<number, string> = {}
    for (let i = 1; i <= Math.min(doc.numPages, 80); i++) {
      try {
        const page = await doc.getPage(i)
        const tc = await page.getTextContent()
        texts[i] = tc.items
        .map((it: any) => it.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        store.setPdfText(i, texts[i])
      } catch (err) {
        console.warn(`[usePdf] text extraction page ${i} failed:`, err)
      }
    }

    const tfidf = buildTFIDF(texts)
    const sections = detectSections(texts, doc.numPages)
    store.setPdfIndex({ tfidf, sections })

    const samplePages = [1, ...sections.slice(0, 6).map((s) => s.pages[0]).filter((p) => p !== 1)]
    const sampleText = samplePages
    .map((n) => `[p.${n}] ${(texts[n] || '').slice(0, 600)}`)
    .join('\n\n')

    store.addMessage({
      id: `sys-${Date.now()}`,
                     type: 'system',
                     content: `⚙ Indexando "${file.name}"…`,
                     timestamp: Date.now(),
    })

    const { chat, settings } = useLectioStore.getState()
    const meta = await buildDocSummary(
      chat.apiKeys.claude,
      chat.apiKeys.gemini,
      settings.geminiModel,
      sampleText
    )

    if (meta) {
      const summary = `Documento: "${meta.title}" (${meta.type}, ${meta.language}). ${meta.summary} Temas: ${meta.themes.join(', ')}.`
      store.setPdfIndex({ summary, themes: meta.themes, ready: true })
    } else {
      store.setPdfIndex({ ready: true })
    }

    store.addMessage({
      id: `sys-${Date.now() + 1}`,
                     type: 'system',
                     content: `📄 "${file.name}" — ${doc.numPages} págs. listas.`,
                     timestamp: Date.now(),
    })
  }, [store])

  const captureArea = useCallback(
    (canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number, pageN: number) => {
      const q = useLectioStore.getState().settings.captureQuality
      const tc = document.createElement('canvas')
      tc.width = w * q
      tc.height = h * q
      const ctx = tc.getContext('2d')!
      ctx.scale(q, q)
      ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h)
      const dataUrl = tc.toDataURL('image/png')
      store.setPendingSnap({ dataUrl, pageN })
      return dataUrl
    },
    [store]
  )

  return {
    setContainer,
    loadFile,
    captureArea,
    setPdfPage: store.setPdfPage,
    setPdfScale: store.setPdfScale,
    setSnapActive: store.setSnapActive,
    setPendingSnap: store.setPendingSnap,
  }
}
