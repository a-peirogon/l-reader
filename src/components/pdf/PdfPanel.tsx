import { useRef, useEffect, useCallback } from 'react'
import { useLectioStore } from '@/store'
import { usePdf } from '@/hooks/usePdf'

const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.3, 1.6, 2.0, 2.5]

export function PdfPanel() {
  const { pdf, setSnapActive, setPendingSnap, addMessage, settings } = useLectioStore()
  const { loadFile, captureArea, setPdfPage, setPdfScale } = usePdf()

  // PdfPanel owns the viewport DOM ref
  const viewportRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const snapState = useRef({
    drawing: false,
    start: { x: 0, y: 0 },
    rectEl: null as HTMLElement | null,
    canvas: null as HTMLCanvasElement | null,
    pageN: 0,
  })

  // File load
  const handleFile = useCallback((file: File | null) => {
    if (!file || file.type !== 'application/pdf') return
    if (!viewportRef.current) return
    loadFile(file, viewportRef.current)
  }, [loadFile])

  // Navigation
  const prevPage = () => pdf.currentPage > 1 && setPdfPage(pdf.currentPage - 1)
  const nextPage = () => pdf.currentPage < pdf.totalPages && setPdfPage(pdf.currentPage + 1)

  const cycleZoom = () => {
    const idx = ZOOM_STEPS.findIndex((s) => s >= pdf.scale)
    const next = ZOOM_STEPS[(idx + 1) % ZOOM_STEPS.length]
    setPdfScale(next)
  }

  const zoomBy = (delta: number) => {
    const newScale = Math.max(0.5, Math.min(2.5, pdf.scale + delta))
    setPdfScale(newScale)
  }

  // Scroll to current page
  useEffect(() => {
    const el = document.getElementById(`pw-${pdf.currentPage}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [pdf.currentPage])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.key === 's' || e.key === 'S') setSnapActive(!pdf.snapActive)
      if (e.key === 'Escape' && pdf.snapActive) setSnapActive(false)
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPage()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevPage()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pdf.snapActive, pdf.currentPage, pdf.totalPages])

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  // Snap mouse events
  const getPos = (e: MouseEvent, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  useEffect(() => {
    if (!viewportRef.current) return
    const viewport = viewportRef.current

    const onDown = (e: MouseEvent) => {
      if (!pdf.snapActive) return
      const wrap = (e.target as HTMLElement).closest('.page-wrap') as HTMLElement | null
      if (!wrap) return
      const canvas = wrap.querySelector('canvas') as HTMLCanvasElement
      const pageN = parseInt(canvas?.dataset.page || '0')
      const pos = getPos(e, wrap)

      snapState.current = { drawing: true, start: pos, rectEl: null, canvas, pageN }

      const rect = document.createElement('div')
      rect.style.cssText = `position:absolute;border:2px solid #fff;background:rgba(255,255,255,.07);border-radius:2px;pointer-events:none;z-index:10;`
      rect.style.left = pos.x + 'px'
      rect.style.top = pos.y + 'px'
      rect.style.width = '0px'
      rect.style.height = '0px'
      wrap.appendChild(rect)
      snapState.current.rectEl = rect
    }

    const onMove = (e: MouseEvent) => {
      if (!snapState.current.drawing || !snapState.current.rectEl) return
      const wrap = (e.target as HTMLElement).closest('.page-wrap') as HTMLElement | null
      if (!wrap) return
      const pos = getPos(e, wrap)
      const { start, rectEl } = snapState.current
      const l = Math.min(start.x, pos.x)
      const t = Math.min(start.y, pos.y)
      const w = Math.abs(pos.x - start.x)
      const h = Math.abs(pos.y - start.y)
      rectEl.style.left = l + 'px'
      rectEl.style.top = t + 'px'
      rectEl.style.width = w + 'px'
      rectEl.style.height = h + 'px'
    }

    const onUp = (e: MouseEvent) => {
      if (!snapState.current.drawing) return
      snapState.current.drawing = false
      const { start, rectEl, canvas, pageN } = snapState.current
      const wrap = rectEl?.parentElement
      if (!wrap) return

      const pos = getPos(e, wrap)
      const l = Math.min(start.x, pos.x)
      const t = Math.min(start.y, pos.y)
      const w = Math.abs(pos.x - start.x)
      const h = Math.abs(pos.y - start.y)
      rectEl?.remove()
      snapState.current.rectEl = null

      if (w > 8 && h > 8 && canvas) {
        const dataUrl = captureArea(canvas, l, t, w, h, pageN)
        if (settings.autoSnap) {
          addMessage({
            id: `snap-${Date.now()}`,
            role: 'user',
            type: 'snap',
            dataUrl,
            pageN,
            label: `Fragmento — p. ${pageN}`,
            timestamp: Date.now(),
          })
        }
      }

      setSnapActive(false)
    }

    viewport.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      viewport.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [pdf.snapActive, captureArea, settings.autoSnap, setSnapActive, addMessage])

  const hasPdf = pdf.totalPages > 0
  const zoomLabel = Math.round(pdf.scale * 100) + '%'

  return (
    <div
      className="relative flex flex-1 flex-col"
      style={{ background: '#000', cursor: pdf.snapActive ? 'crosshair' : undefined }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="flex h-[42px] flex-shrink-0 items-center gap-2 border-b border-[#1a1a1a] bg-[#0d0d0d] px-3">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="file-input-pdf"
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-[#ccc] transition-all hover:bg-[#1e1e1e]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23,4 23,10 17,10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Abrir
          </label>
          <input
            id="file-input-pdf"
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          {hasPdf && (
            <>
              <div className="mx-0.5 h-4 w-px bg-[#1e1e1e]" />
              {/* Page nav */}
              <div className="flex h-7 items-center overflow-hidden rounded-lg border border-[#1e1e1e] bg-[#0e0e0e]">
                <button
                  onClick={prevPage}
                  disabled={pdf.currentPage <= 1}
                  className="flex h-7 w-7 items-center justify-center text-[#444] transition-all hover:bg-[#1a1a1a] hover:text-[#bbb] disabled:opacity-25"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6" /></svg>
                </button>
                <div className="flex h-full items-center gap-1 border-x border-[#1a1a1a] px-2 font-mono text-[11px]">
                  <input
                    type="number"
                    value={pdf.currentPage}
                    min={1}
                    max={pdf.totalPages}
                    onChange={(e) => {
                      const v = parseInt(e.target.value)
                      if (v >= 1 && v <= pdf.totalPages) setPdfPage(v)
                    }}
                    className="w-7 bg-transparent text-center text-[11px] font-semibold text-[#ddd] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[#333]">/ {pdf.totalPages}</span>
                </div>
                <button
                  onClick={nextPage}
                  disabled={pdf.currentPage >= pdf.totalPages}
                  className="flex h-7 w-7 items-center justify-center text-[#444] transition-all hover:bg-[#1a1a1a] hover:text-[#bbb] disabled:opacity-25"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9,18 15,12 9,6" /></svg>
                </button>
              </div>
              <div className="mx-0.5 h-4 w-px bg-[#1e1e1e]" />
              <button
                onClick={cycleZoom}
                className="flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] text-[#aaa] transition-all hover:bg-[#1e1e1e]"
              >
                {zoomLabel}
                <span className="text-[9px] text-[#333]">▾</span>
              </button>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {hasPdf && (
            <>
              <button
                onClick={() => setSnapActive(!pdf.snapActive)}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] tracking-[.04em] transition-all ${
                  pdf.snapActive
                    ? 'border-white bg-white text-black'
                    : 'border-transparent text-[#555] hover:border-[#2a2a2a] hover:bg-[#1a1a1a] hover:text-[#999]'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <rect x="8" y="10" width="8" height="6" rx="1" />
                </svg>
                Capturar
              </button>
              <div className="mx-0.5 h-4 w-px bg-[#1e1e1e]" />
            </>
          )}
        </div>
      </div>

      {/* Viewport */}
      <div
        ref={viewportRef}
        className="flex flex-1 flex-col items-center gap-5 overflow-auto px-5 py-6 pb-20"
        style={{
          background: '#000',
          perspective: '1800px',
          perspectiveOrigin: '50% 40%',
          scrollbarWidth: 'thin',
          scrollbarColor: '#222 transparent',
        }}
      >
        {/* Drop zone — shown only when no PDF loaded */}
        {!hasPdf && (
          <div
            className="absolute inset-[42px_0_0_0] flex cursor-pointer flex-col items-center justify-center gap-3"
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
            <div className="text-[17px] font-normal text-[#333]">Arrastra tu PDF aquí</div>
            <div className="font-mono text-[11px] text-[#2a2a2a]">o haz clic en "Abrir"</div>
          </div>
        )}
      </div>

      {/* Floating nav */}
      {hasPdf && (
        <div className="absolute bottom-[18px] left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-[#1f1f1f] bg-[#111] px-2 py-1.5 opacity-0 shadow-[0_6px_20px_rgba(0,0,0,.5)] transition-opacity hover:opacity-100 [.pdf-panel:hover_&]:opacity-100">
          <button onClick={() => zoomBy(-0.2)} className="flex h-7 w-7 items-center justify-center rounded-full text-[#666] transition-all hover:bg-white/5 hover:text-[#ccc]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <button onClick={() => zoomBy(0.2)} className="flex h-7 w-7 items-center justify-center rounded-full text-[#666] transition-all hover:bg-white/5 hover:text-[#ccc]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <div className="mx-1 h-4 w-px bg-[#222]" />
          <button onClick={prevPage} disabled={pdf.currentPage <= 1} className="flex h-7 w-7 items-center justify-center rounded-full text-[#666] transition-all hover:bg-white/5 hover:text-[#ccc] disabled:opacity-30">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6"/></svg>
          </button>
          <span className="whitespace-nowrap px-1.5 font-mono text-[11px] text-[#444]">{pdf.currentPage} / {pdf.totalPages}</span>
          <button onClick={nextPage} disabled={pdf.currentPage >= pdf.totalPages} className="flex h-7 w-7 items-center justify-center rounded-full text-[#666] transition-all hover:bg-white/5 hover:text-[#ccc] disabled:opacity-30">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9,18 15,12 9,6"/></svg>
          </button>
        </div>
      )}

      {/* Hidden file input shared with ChatPanel */}
      <input
        id="file-input-chat"
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}
