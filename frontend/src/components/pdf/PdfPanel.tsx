import { useRef, useEffect, useCallback, useState } from 'react'
import { useLectioStore } from '@/store'
import { usePdf } from '@/hooks/usePdf'
import { useAnnotations } from '@/hooks/useAnnotations'
import { AnnotationLayer } from '@/components/pdf/AnnotationLayer'
import { exportWithAnnotations } from '@/lib/pdf/export'
import { ANNOTATION_COLORS } from '@/types'
import type { AnnotationColor } from '@/types'

const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.3, 1.6, 2.0, 2.5]

// ─── Toolbar icon button ──────────────────────────────────────────────────────

function ToolBtn({ active, activeColor, onClick, title, children }: {
  active?: boolean; activeColor?: string; onClick: () => void; title: string; children: React.ReactNode
}) {
  return (
    <button
    onClick={onClick}
    title={title}
    className="relative flex h-7 w-7 items-center justify-center rounded-md transition-all"
    style={active
      ? { background: (activeColor ?? '#fff') + '22', color: activeColor ?? '#fff' }
      : { color: '#555' }
    }
    onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#999' }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#555' }}
    >
    {children}
    {active && (
      <span className="absolute bottom-[3px] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full"
      style={{ background: activeColor ?? '#fff' }} />
    )}
    </button>
  )
}

export function PdfPanel() {
  const { pdf, setSnapActive } = useLectioStore()
  const { setContainer, loadFile, captureArea, setPdfPage, setPdfScale } = usePdf()
  const ann = useAnnotations()

  const [exporting, setExporting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const snapState = useRef({
    drawing: false, start: { x: 0, y: 0 },
    rectEl: null as HTMLElement | null,
    canvas: null as HTMLCanvasElement | null, pageN: 0,
  })

  const handleFile = useCallback((file: File | null) => {
    if (!file) return
      if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) return
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
    const idx = ZOOM_STEPS.findIndex(s => s >= pdf.scale)
    setPdfScale(ZOOM_STEPS[(idx + 1) % ZOOM_STEPS.length])
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
        if (e.key === 's' || e.key === 'S') setSnapActive(!useLectioStore.getState().pdf.snapActive)
          if (e.key === 'h' || e.key === 'H') ann.setTool(ann.tool === 'highlight' ? 'none' : 'highlight')
            if (e.key === 'n' || e.key === 'N') ann.setTool(ann.tool === 'note' ? 'none' : 'note')
              if (e.key === 'Escape') { setSnapActive(false); ann.setTool('none') }
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPage()
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevPage()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextPage, prevPage, ann, setSnapActive])

  const viewportRefCallback = useCallback((el: HTMLDivElement | null) => {
    viewportRef.current = el; setContainer(el)
  }, [setContainer])

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
            pages.forEach(el => {
              const visible = Math.max(0, Math.min(vBottom, el.offsetTop + el.offsetHeight) - Math.max(vTop, el.offsetTop))
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

  // Snap drawing
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
      try { await exportWithAnnotations(pdf.doc, ann.allAnnotations, pdf.name) }
      catch (err: any) { alert(`Error al exportar: ${err.message}`) }
      finally { setExporting(false) }
  }

  const hasPdf = pdf.totalPages > 0
  const zoomLabel = Math.round(pdf.scale * 100) + '%'

  return (
    <div
    className="relative flex h-full w-full flex-col"
    style={{ background: '#000', cursor: pdf.snapActive && ann.tool === 'none' ? 'crosshair' : undefined }}
    onDragOver={handleDragOver}
    onDrop={handleDrop}
    >
    {/* ── Toolbar ── */}
    <div className="relative flex h-[42px] flex-shrink-0 items-center border-b border-[#1a1a1a] bg-[#0d0d0d] px-3">

    {/* Left: page navigation + zoom */}
    <div className="flex items-center gap-1.5">
    {hasPdf && (
      <>
      <div className="flex h-7 items-center overflow-hidden rounded-lg border border-[#1e1e1e] bg-[#0e0e0e]">
      <button onClick={prevPage} disabled={pdf.currentPage <= 1}
      className="flex h-7 w-7 items-center justify-center text-[#444] transition-colors hover:bg-[#1a1a1a] hover:text-[#bbb] disabled:opacity-25">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6" /></svg>
      </button>
      <div className="flex h-full items-center gap-1 border-x border-[#1a1a1a] px-2 font-mono text-[11px]">
      <input type="number" value={pdf.currentPage} min={1} max={pdf.totalPages}
      onChange={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= pdf.totalPages) setPdfPage(v) }}
      className="w-7 bg-transparent text-center text-[11px] font-semibold text-[#ddd] outline-none [appearance:textfield]" />
      <span className="text-[#333]">/ {pdf.totalPages}</span>
      </div>
      <button onClick={nextPage} disabled={pdf.currentPage >= pdf.totalPages}
      className="flex h-7 w-7 items-center justify-center text-[#444] transition-colors hover:bg-[#1a1a1a] hover:text-[#bbb] disabled:opacity-25">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9,18 15,12 9,6" /></svg>
      </button>
      </div>
      <div className="mx-0.5 h-4 w-px bg-[#1e1e1e]" />
      <button onClick={cycleZoom}
      className="flex items-center gap-0.5 rounded-md px-1.5 py-1 font-mono text-[12px] text-[#666] transition-colors hover:bg-[#1a1a1a] hover:text-[#aaa]">
      {zoomLabel}<span className="ml-0.5 text-[9px] text-[#333]">▾</span>
      </button>
      </>
    )}
    </div>

    {/* Center: annotation tools (absolute) */}
    {hasPdf && (
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5">
      {/* Highlight */}
      <ToolBtn
      active={ann.tool === 'highlight'} activeColor={ann.color}
      onClick={() => ann.setTool(ann.tool === 'highlight' ? 'none' : 'highlight')}
      title="Resaltar texto  H"
      >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M15.5 3.5 20.5 8.5l-11 11H4.5v-5L15.5 3.5z"/>
      <path d="M4 20h16" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      </ToolBtn>

      {/* Note */}
      <ToolBtn
      active={ann.tool === 'note'} activeColor={ann.color}
      onClick={() => ann.setTool(ann.tool === 'note' ? 'none' : 'note')}
      title="Añadir nota  N"
      >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      </ToolBtn>

      <div className="mx-1.5 h-4 w-px bg-[#1f1f1f]" />

      {/* Color swatches */}
      {ANNOTATION_COLORS.map(c => (
        <button
        key={c}
        onClick={() => ann.setColor(c as AnnotationColor)}
        title={c}
        className="transition-transform hover:scale-110"
        style={{
          width: 13, height: 13, borderRadius: '50%', background: c,
          border: ann.color === c ? '2px solid #fff' : '2px solid transparent',
          cursor: 'pointer', outline: 'none', padding: 0, margin: '0 1px',
          flexShrink: 0,
        }}
        />
      ))}
      </div>
    )}

    {/* Right: icon-only snap + export */}
    <div className="ml-auto flex items-center gap-0.5">
    {hasPdf && (
      <>
      {/* Capture */}
      <ToolBtn
      active={pdf.snapActive} activeColor="#fff"
      onClick={() => setSnapActive(!pdf.snapActive)}
      title="Capturar área  S"
      >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
      </svg>
      </ToolBtn>

      <div className="mx-0.5 h-4 w-px bg-[#1e1e1e]" />

      {/* Export PDF */}
      <ToolBtn
      active={false}
      onClick={handleExport}
      title="Exportar PDF con anotaciones"
      >
      {exporting ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
        <circle cx="12" cy="12" r="10" strokeOpacity=".2" /><path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7,10 12,15 17,10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
      </ToolBtn>
      </>
    )}
    </div>
    </div>

    {/* ── Viewport ── */}
    <div
    ref={viewportRefCallback}
    className="flex flex-col items-center px-5 py-6 pb-20"
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
      <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="12" y2="12" /><line x1="15" y1="15" x2="12" y2="12" />
      </svg>
      </div>
      <p className="text-[11px] font-medium text-[#2a2a2a]">Arrastra un PDF o haz clic</p>
      </div>
    )}

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

    {/* Hidden file inputs */}
    <input id="file-input-pdf" ref={fileInputRef} type="file" accept=".pdf" className="hidden"
    onChange={e => handleFile(e.target.files?.[0] ?? null)} />
    <input id="file-input-chat" type="file" accept=".pdf" className="hidden"
    onChange={e => handleFile(e.target.files?.[0] ?? null)} />
    </div>
  )
}
