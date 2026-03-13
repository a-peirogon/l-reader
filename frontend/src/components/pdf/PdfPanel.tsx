import { useRef, useEffect, useCallback, useState } from 'react'
import { useLectioStore } from '@/store'
import { usePdf } from '@/hooks/usePdf'
import { useAnnotations } from '@/hooks/useAnnotations'
import { AnnotationLayer } from '@/components/pdf/AnnotationLayer'
import { exportWithAnnotations } from '@/lib/pdf/export'

const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.3, 1.6, 2.0, 2.5]

export function PdfPanel() {
  const { pdf, setSnapActive, setPendingSnap, addMessage } = useLectioStore()
  const { setContainer, loadFile, captureArea, setPdfPage, setPdfScale } = usePdf()
  const ann = useAnnotations()

  const [exporting, setExporting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const snapState = useRef({
    drawing: false,
    start: { x: 0, y: 0 },
    rectEl: null as HTMLElement | null,
    canvas: null as HTMLCanvasElement | null,
    pageN: 0,
  })

  const handleFile = useCallback((file: File | null) => {
    if (!file) return
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) return
        loadFile(file)
  }, [loadFile])

  const prevPage = useCallback(() => {
    useLectioStore.getState().setPdfPage(Math.max(1, useLectioStore.getState().pdf.currentPage - 1))
  }, [])
  const nextPage = useCallback(() => {
    const s = useLectioStore.getState()
    s.setPdfPage(Math.min(s.pdf.totalPages, s.pdf.currentPage + 1))
  }, [])

  const cycleZoom = () => {
    const idx = ZOOM_STEPS.findIndex((s) => s >= pdf.scale)
    setPdfScale(ZOOM_STEPS[(idx + 1) % ZOOM_STEPS.length])
  }
  const zoomBy = (delta: number) => {
    setPdfScale(Math.max(0.5, Math.min(2.5, pdf.scale + delta)))
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
        if (e.key === 's' || e.key === 'S') {
          useLectioStore.getState().setSnapActive(!useLectioStore.getState().pdf.snapActive)
        }
        if (e.key === 'Escape') {
          useLectioStore.getState().setSnapActive(false)
          ann.setTool('none')
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPage()
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevPage()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextPage, prevPage, ann])

  const viewportRefCallback = useCallback((el: HTMLDivElement | null) => {
    viewportRef.current = el
    setContainer(el)
  }, [setContainer])

  // Listen for PDF imports triggered from SearchPanel
  useEffect(() => {
    const handler = (e: Event) => handleFile((e as CustomEvent).detail.file)
    window.addEventListener('lectio:load-pdf', handler)
    return () => window.removeEventListener('lectio:load-pdf', handler)
  }, [handleFile])

  const programmingScrollRef = useRef(false)
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !pdf.totalPages) return
      const pageEl = viewport.querySelector(`#pw-${pdf.currentPage}`) as HTMLElement | null
      if (!pageEl) return
        programmingScrollRef.current = true
        if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
          suppressTimerRef.current = setTimeout(() => { programmingScrollRef.current = false }, 600)
          viewport.scrollTo({ top: pageEl.offsetTop - 28, behavior: 'smooth' })
  }, [pdf.currentPage, pdf.totalPages])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !pdf.totalPages) return
      const onScroll = () => {
        if (programmingScrollRef.current) return
          const pages = viewport.querySelectorAll<HTMLElement>('.page-wrap')
          if (!pages.length) return
            const vTop = viewport.scrollTop, vBottom = vTop + viewport.clientHeight
            let bestPage = 0, bestVisible = 0
            pages.forEach((el) => {
              const elTop = el.offsetTop, elBottom = elTop + el.offsetHeight
              const visible = Math.max(0, Math.min(vBottom, elBottom) - Math.max(vTop, elTop))
              if (visible > bestVisible) { bestVisible = visible; bestPage = parseInt(el.id.replace('pw-', '')) || 0 }
            })
            if (bestPage > 0 && bestPage !== useLectioStore.getState().pdf.currentPage) {
              useLectioStore.getState().setPdfPage(bestPage)
            }
      }
      viewport.addEventListener('scroll', onScroll, { passive: true })
      return () => viewport.removeEventListener('scroll', onScroll)
  }, [pdf.totalPages])

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }

  // Snap tool — only active when annotation tool is 'none'
  useEffect(() => {
    const getPos = (e: MouseEvent, el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const onDown = (e: MouseEvent) => {
      if (!useLectioStore.getState().pdf.snapActive) return
        if (useLectioStore.getState().annotations.tool !== 'none') return
          const wrap = (e.target as HTMLElement).closest('.page-wrap') as HTMLElement | null
          if (!wrap) return
            const canvas = wrap.querySelector('canvas') as HTMLCanvasElement
            const pageN = parseInt(canvas?.dataset.page || '0')
            const pos = getPos(e, wrap)
            const rect = document.createElement('div')
            rect.style.cssText = 'position:absolute;border:2px solid #fff;background:rgba(255,255,255,.07);border-radius:2px;pointer-events:none;z-index:10;'
            rect.style.left = pos.x + 'px'; rect.style.top = pos.y + 'px'
  wrap.appendChild(rect)
  snapState.current = { drawing: true, start: pos, rectEl: rect, canvas, pageN }
    }
    const onMove = (e: MouseEvent) => {
      const { drawing, rectEl, start } = snapState.current
      if (!drawing || !rectEl) return
        const wrap = rectEl.parentElement as HTMLElement
        const pos = getPos(e, wrap)
        const l = Math.min(start.x, pos.x), t = Math.min(start.y, pos.y)
        rectEl.style.left = l + 'px'; rectEl.style.top = t + 'px'
        rectEl.style.width = Math.abs(pos.x - start.x) + 'px'
        rectEl.style.height = Math.abs(pos.y - start.y) + 'px'
    }
    const onUp = (e: MouseEvent) => {
      const { drawing, start, rectEl, canvas, pageN } = snapState.current
      if (!drawing) return
        snapState.current.drawing = false
        const wrap = rectEl?.parentElement as HTMLElement | null
        rectEl?.remove(); snapState.current.rectEl = null
        if (!wrap || !canvas) return
          const pos = getPos(e, wrap)
          const w = Math.abs(pos.x - start.x), h = Math.abs(pos.y - start.y)
          if (w > 8 && h > 8) {
            const dataUrl = captureArea(canvas, Math.min(start.x, pos.x), Math.min(start.y, pos.y), w, h, pageN)
            if (useLectioStore.getState().settings.autoSnap) {
              useLectioStore.getState().addMessage({
                id: `snap-${Date.now()}`, role: 'user', type: 'snap',
                                                   dataUrl, pageN, label: `Fragmento — p. ${pageN}`, timestamp: Date.now(),
              })
              useLectioStore.getState().setPendingSnap(null)
            }
          }
          useLectioStore.getState().setSnapActive(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [captureArea])

  const handleExport = async () => {
    if (!pdf.doc || exporting) return
      setExporting(true)
      try {
        await exportWithAnnotations(pdf.doc, ann.allAnnotations, pdf.name)
      } catch (err: any) {
        alert(`Error al exportar: ${err.message}`)
      } finally {
        setExporting(false)
      }
  }

  const hasPdf = pdf.totalPages > 0
  const zoomLabel = Math.round(pdf.scale * 100) + '%'
  const annotationMode = ann.tool !== 'none'

  return (
    <div
    className="relative flex h-full w-full flex-col"
    style={{ background: '#000', cursor: pdf.snapActive && !annotationMode ? 'crosshair' : undefined }}
    onDragOver={handleDragOver}
    onDrop={handleDrop}
    >
    {/* Toolbar */}
    <div className="flex h-[42px] flex-shrink-0 items-center gap-2 border-b border-[#1a1a1a] bg-[#0d0d0d] px-3">
    {/* Left: open + navigation + zoom */}
    <div className="flex items-center gap-1.5">
    <label htmlFor="file-input-pdf"
    className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-[#ccc] transition-all hover:bg-[#1e1e1e]">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23,4 23,10 17,10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
    Abrir
    </label>
    <input id="file-input-pdf" ref={fileInputRef} type="file" accept=".pdf" className="hidden"
    onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />

    {hasPdf && (
      <>
      <div className="mx-0.5 h-4 w-px bg-[#1e1e1e]" />
      <div className="flex h-7 items-center overflow-hidden rounded-lg border border-[#1e1e1e] bg-[#0e0e0e]">
      <button onClick={prevPage} disabled={pdf.currentPage <= 1}
      className="flex h-7 w-7 items-center justify-center text-[#444] transition-all hover:bg-[#1a1a1a] hover:text-[#bbb] disabled:opacity-25">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6" /></svg>
      </button>
      <div className="flex h-full items-center gap-1 border-x border-[#1a1a1a] px-2 font-mono text-[11px]">
      <input type="number" value={pdf.currentPage} min={1} max={pdf.totalPages}
      onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= pdf.totalPages) setPdfPage(v) }}
      className="w-7 bg-transparent text-center text-[11px] font-semibold text-[#ddd] outline-none [appearance:textfield]" />
      <span className="text-[#333]">/ {pdf.totalPages}</span>
      </div>
      <button onClick={nextPage} disabled={pdf.currentPage >= pdf.totalPages}
      className="flex h-7 w-7 items-center justify-center text-[#444] transition-all hover:bg-[#1a1a1a] hover:text-[#bbb] disabled:opacity-25">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9,18 15,12 9,6" /></svg>
      </button>
      </div>
      <div className="mx-0.5 h-4 w-px bg-[#1e1e1e]" />
      <button onClick={cycleZoom}
      className="flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] text-[#aaa] transition-all hover:bg-[#1e1e1e]">
      {zoomLabel}<span className="text-[9px] text-[#333]">▾</span>
      </button>
      </>
    )}
    </div>

    {/* Right: snap + export */}
    <div className="ml-auto flex items-center gap-1">
    {hasPdf && (
      <>
      {/* Snap */}
      <button onClick={() => setSnapActive(!pdf.snapActive)}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] tracking-[.04em] transition-all ${
        pdf.snapActive ? 'border-white bg-white text-black' : 'border-transparent text-[#555] hover:border-[#2a2a2a] hover:bg-[#1a1a1a] hover:text-[#999]'
      }`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <rect x="8" y="10" width="8" height="6" rx="1" />
      </svg>
      Capturar
      </button>
      <div className="mx-0.5 h-4 w-px bg-[#1e1e1e]" />
      {/* Export */}
      <button onClick={handleExport} disabled={exporting}
      title="Exportar PDF con anotaciones"
      className="flex h-7 items-center gap-1.5 rounded-md border border-transparent px-2 py-1 font-mono text-[11px] tracking-[.04em] text-[#555] transition-all hover:border-[#2a2a2a] hover:bg-[#1a1a1a] hover:text-[#999] disabled:opacity-40">
      {exporting ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
        <circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7,10 12,15 17,10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
      Exportar
      </button>
      </>
    )}
    </div>
    </div>

    {/* Viewport — position:absolute below toolbar, proven layout */}
    <div
    ref={viewportRefCallback}
    className="flex flex-col items-center px-5 py-6 pb-20"
    data-tool-active={pdf.snapActive || ann.tool === 'note' ? 'true' : undefined}
    style={{
      position: 'absolute', top: 42, bottom: 0, left: 0, right: 0,
      overflowY: 'auto', background: '#000',
      scrollbarWidth: 'thin', scrollbarColor: '#222 transparent',
    }}
    >
    {!hasPdf && (
      <div
      className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3"
      onClick={() => fileInputRef.current?.click()}
      >
      <div className="flex h-[58px] w-[58px] items-center justify-center rounded-[10px] border-2 border-dashed border-[#2a2a2a] text-[#333] transition-all hover:border-[#555] hover:text-[#666]">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="12" y2="12" />
      <line x1="15" y1="15" x2="12" y2="12" />
      </svg>
      </div>
      </div>
    )}

    {/* Annotation layer — portals SVGs into each .page-wrap */}
    {hasPdf && (
      <AnnotationLayer
      viewportEl={viewportRef.current}
      totalPages={pdf.totalPages}
      scale={pdf.scale}
      annotations={ann.allAnnotations}
      tool={ann.tool}
      color={ann.color}
      onAdd={ann.add}
      onUpdate={ann.update}
      onDelete={ann.remove}
      />
    )}
    </div>

    {/* Floating nav — annotation tools only */}
    {hasPdf && (
      <div className="absolute bottom-[18px] flex items-center gap-0.5 rounded-full border border-[#1f1f1f] bg-[#111] px-2 py-1.5 opacity-0 shadow-[0_6px_20px_rgba(0,0,0,.5)] transition-[opacity] hover:opacity-100"
      style={{ left: '50%', transform: 'translateX(-50%)' }}>

      {([
        { tool: 'highlight' as const, tip: 'Resaltar  H', color: '#e8c84a', icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M15.5 3.5 20.5 8.5l-11 11H4.5v-5L15.5 3.5z"/>
          <path d="M4 20h16" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        )},
        { tool: 'note' as const, tip: 'Nota  N', color: '#b07ee8', icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )},
      ]).map(({ tool, tip, color, icon }) => (
        <button
        key={tool}
        onClick={() => ann.setTool(ann.tool === tool ? 'none' : tool)}
        title={tip}
        className="relative flex h-7 w-7 items-center justify-center rounded-full transition-all"
        style={ann.tool === tool
          ? { background: color + '1f', color }
          : { color: '#666' }
        }
        >
        {icon}
        {ann.tool === tool && (
          <span
          className="absolute bottom-[3px] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full"
          style={{ background: color }}
          />
        )}
        </button>
      ))}
      </div>
    )}

    {/* Shared file inputs */}
    <input id="file-input-chat" type="file" accept=".pdf" className="hidden"
    onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
    </div>
  )
}
