import { useCallback } from 'react'
import { useLectioStore } from '@/store'
import { buildTFIDF, detectSections } from '@/lib/pdf/intelligence'
import { buildDocSummary } from '@/lib/ai'

// Lazy-load pdfjs to avoid bundler issues
let pdfjsLib: any = null
async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  }
  return pdfjsLib
}

export function usePdf() {
  const {
    setPdfDoc,
    setPdfPage,
    setPdfScale,
    setPdfText,
    setPdfIndex,
    setSnapActive,
    setPendingSnap,
    resetPdf,
    pdf,
    chat,
    settings,
    addMessage,
  } = useLectioStore()

  // ── Load PDF file ──────────────────────────────────────────
  // viewportRef is owned by PdfPanel and passed in here
  const loadFile = useCallback(
    async (file: File, container: HTMLDivElement) => {
      resetPdf()

      // Clear any existing pages from viewport
      container.querySelectorAll('.page-wrap').forEach((el) => el.remove())

      const lib = await getPdfJs()
      const buffer = await file.arrayBuffer()
      const doc = await lib.getDocument(new Uint8Array(buffer)).promise

      setPdfDoc(doc, file.name, doc.numPages)

      // Render pages directly into the container we were given
      const scale = 1.3
      for (let i = 1; i <= Math.min(doc.numPages, 50); i++) {
        await renderPageToContainer(doc, i, scale, container)
      }

      // Extract text in background
      const texts: Record<number, string> = {}
      for (let i = 1; i <= Math.min(doc.numPages, 80); i++) {
        const page = await doc.getPage(i)
        const tc = await page.getTextContent()
        const text = tc.items
          .map((it: any) => it.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        texts[i] = text
        setPdfText(i, text)
      }

      // Build TF-IDF + sections
      const tfidf = buildTFIDF(texts)
      const sections = detectSections(texts, doc.numPages)
      setPdfIndex({ tfidf, sections })

      // AI summarization
      const samplePages = [
        1,
        ...sections.slice(0, 6).map((s) => s.pages[0]).filter((p) => p !== 1),
      ]
      const sampleText = samplePages
        .map((n) => `[p.${n}] ${(texts[n] || '').slice(0, 600)}`)
        .join('\n\n')

      addMessage({
        id: `sys-${Date.now()}`,
        type: 'system',
        content: `⚙ Indexando "${file.name}"…`,
        timestamp: Date.now(),
      })

      const meta = await buildDocSummary(
        chat.apiKeys.claude,
        chat.apiKeys.gemini,
        settings.geminiModel,
        sampleText
      )

      if (meta) {
        const summary = `Documento: "${meta.title}" (${meta.type}, ${meta.language}). ${meta.summary} Temas: ${meta.themes.join(', ')}.`
        setPdfIndex({ summary, themes: meta.themes, ready: true })
        addMessage({
          id: `sys-${Date.now() + 1}`,
          type: 'system',
          content: `📄 "${file.name}" — ${doc.numPages} págs. indexadas.`,
          timestamp: Date.now(),
        })
      } else {
        setPdfIndex({ ready: true })
        addMessage({
          id: `sys-${Date.now() + 1}`,
          type: 'system',
          content: `📄 "${file.name}" — ${doc.numPages} págs. (indexación sin IA).`,
          timestamp: Date.now(),
        })
      }
    },
    [chat.apiKeys, settings.geminiModel, resetPdf, setPdfDoc, setPdfText, setPdfIndex, addMessage]
  )

  // ── Render a single page ──────────────────────────────────
  const renderPageToContainer = async (
    doc: any,
    n: number,
    scale: number,
    container: HTMLDivElement
  ) => {
    const page = await doc.getPage(n)
    const vp = page.getViewport({ scale })

    const existing = container.querySelector(`#pw-${n}`)
    if (existing) existing.remove()

    const wrap = document.createElement('div')
    wrap.id = `pw-${n}`
    wrap.className = 'page-wrap'
    wrap.style.cssText = `position:relative;flex-shrink:0;width:${vp.width}px;height:${vp.height}px;background:#000;border-radius:3px;box-shadow:0 4px 32px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.04);`

    const badge = document.createElement('div')
    badge.textContent = `p. ${n}`
    badge.style.cssText = `position:absolute;top:-19px;left:0;font-size:10px;font-family:'IBM Plex Mono',monospace;color:#333;letter-spacing:.05em;`

    const canvas = document.createElement('canvas')
    canvas.width = vp.width
    canvas.height = vp.height
    canvas.dataset.page = String(n)
    canvas.style.cssText = `display:block;filter:invert(1);`
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise

    const textLayer = document.createElement('div')
    textLayer.id = `tl-${n}`
    textLayer.style.cssText = `position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;opacity:1;line-height:1;z-index:2;pointer-events:none;`

    try {
      const tc = await page.getTextContent()
      renderTextSpans(tc, textLayer, vp, scale)
    } catch (_) {}

    const selOverlay = document.createElement('div')
    selOverlay.id = `ov-${n}`
    selOverlay.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:6;`

    wrap.append(badge, canvas, textLayer, selOverlay)

    // Staggered flip-in animation
    const delay = Math.min((n - 1) * 60, 400)
    wrap.style.opacity = '0'
    wrap.style.transform = 'rotateY(-30deg) translateX(-60px) scale(0.94)'
    wrap.style.transition = `opacity 0.52s cubic-bezier(0.22,0.61,0.36,1) ${delay}ms, transform 0.52s cubic-bezier(0.22,0.61,0.36,1) ${delay}ms`
    container.appendChild(wrap)
    requestAnimationFrame(() => {
      wrap.style.opacity = '1'
      wrap.style.transform = 'rotateY(0) translateX(0) scale(1)'
    })
  }

  const renderTextSpans = (tc: any, container: HTMLElement, vp: any, scale: number) => {
    for (const item of tc.items) {
      if (!item.str?.trim()) continue
      const span = document.createElement('span')
      span.textContent = item.str + (item.hasEOL ? ' ' : '')
      const [a, b, , , e, f] = item.transform
      const angle = Math.atan2(b, a)
      const fontSize = Math.sqrt(a * a + b * b) * scale
      span.style.cssText = `
        color:transparent;position:absolute;white-space:pre;cursor:text;
        transform-origin:0% 0%;user-select:text;
        left:${e * scale}px;top:${vp.height - f * scale - fontSize}px;
        font-size:${fontSize}px;transform:rotate(${angle}rad);
      `
      container.appendChild(span)
    }
  }

  // ── Area capture ──────────────────────────────────────────
  const captureArea = useCallback(
    (canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number, pageN: number) => {
      const q = settings.captureQuality
      const tc = document.createElement('canvas')
      tc.width = w * q
      tc.height = h * q
      const ctx = tc.getContext('2d')!
      ctx.scale(q, q)
      ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h)
      const dataUrl = tc.toDataURL('image/png')
      setPendingSnap({ dataUrl, pageN })
      return dataUrl
    },
    [settings.captureQuality, setPendingSnap]
  )

  return {
    loadFile,
    captureArea,
    setPdfPage,
    setPdfScale,
    setSnapActive,
    setPendingSnap,
  }
}
