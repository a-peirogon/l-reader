import { useRef, useEffect, useCallback, useState } from 'react'
import { useLectioStore } from '@/store'
import { usePdf } from '@/hooks/usePdf'
import { SearchPanel } from '@/components/search/SearchPanel'

const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.3, 1.6, 2.0, 2.5]

export function PdfPanel() {
  const { pdf, setSnapActive, setPendingSnap, addMessage, settings } = useLectioStore()
  const { setContainer, loadFile, captureArea, setPdfPage, setPdfScale } = usePdf()

  const [searchOpen, setSearchOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const snapState = useRef({
    drawing: false,
    start: { x: 0, y: 0 },
    rectEl: null as HTMLElement | null,
    canvas: null as HTMLCanvasElement | null,
    pageN: 0,
  })

  // File load — accepts by MIME type OR by extension (drag-and-drop may omit MIME)
  const handleFile = useCallback((file: File | null) => {
    if (!file) return
      const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) return
        loadFile(file)
  }, [loadFile])

  // Navigation
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
          setSearchOpen(false)
        }
        if (e.key === 'f' || e.key === 'F') setSearchOpen((v) => !v)
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPage()
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevPage()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextPage, prevPage])

  const viewportRef = useRef<HTMLDivElement | null>(null)

  const viewportRefCallback = useCallback((el: HTMLDivElement | null) => {
    viewportRef.current = el
    setContainer(el)
  }, [setContainer])

  const programmingScrollRef = useRef(false)
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !pdf.totalPages) return
      const pageEl = viewport.querySelector(`#pw-${pdf.currentPage}`) as HTMLElement | null
      if (!pageEl) return

        programmingScrollRef.current = true
        if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
          suppressTimerRef.current = setTimeout(() => {
            programmingScrollRef.current = false
          }, 600)

          viewport.scrollTo({ top: pageEl.offsetTop - 28, behavior: 'smooth' })
  }, [pdf.currentPage, pdf.totalPages])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !pdf.totalPages) return

      const onScroll = () => {
        if (programmingScrollRef.current) return

          const pages = viewport.querySelectorAll<HTMLElement>('.page-wrap')
          if (!pages.length) return

            const vTop = viewport.scrollTop
            const vBottom = vTop + viewport.clientHeight

            let bestPage = 0
            let bestVisible = 0

            pages.forEach((el) => {
              const elTop = el.offsetTop
              const elBottom = elTop + el.offsetHeight
              const visibleTop = Math.max(vTop, elTop)
              const visibleBottom = Math.min(vBottom, elBottom)
              const visible = Math.max(0, visibleBottom - visibleTop)
              if (visible > bestVisible) {
                bestVisible = visible
                bestPage = parseInt(el.id.replace('pw-', '')) || 0
              }
            })

            if (bestPage > 0 && bestPage !== useLectioStore.getState().pdf.currentPage) {
              useLectioStore.getState().setPdfPage(bestPage)
            }
      }

      viewport.addEventListener('scroll', onScroll, { passive: true })
      return () => viewport.removeEventListener('scroll', onScroll)
  }, [pdf.totalPages])

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  // Snap mouse events
  useEffect(() => {
    const getPos = (e: MouseEvent, el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const onDown = (e: MouseEvent) => {
      if (!useLectioStore.getState().pdf.snapActive) return
        const wrap = (e.target as HTMLElement).closest('.page-wrap') as HTMLElement | null
        if (!wrap) return
          const canvas = wrap.querySelector('canvas') as HTMLCanvasElement
          const pageN = parseInt(canvas?.dataset.page || '0')
          const pos = getPos(e, wrap)

          const rect = document.createElement('div')
          rect.style.cssText =
          'position:absolute;border:2px solid #fff;background:rgba(255,255,255,.07);border-radius:2px;pointer-events:none;z-index:10;'
          rect.style.left = pos.x + 'px'
          rect.style.top = pos.y + 'px'
  wrap.appendChild(rect)

  snapState.current = { drawing: true, start: pos, rectEl: rect, canvas, pageN }
    }

    const onMove = (e: MouseEvent) => {
      const { drawing, rectEl, start } = snapState.current
      if (!drawing || !rectEl) return
        const wrap = rectEl.parentElement as HTMLElement
        const pos = getPos(e, wrap)
        const l = Math.min(start.x, pos.x)
        const t = Math.min(start.y, pos.y)
        rectEl.style.left = l + 'px'
        rectEl.style.top = t + 'px'
        rectEl.style.width = Math.abs(pos.x - start.x) + 'px'
        rectEl.style.height = Math.abs(pos.y - start.y) + 'px'
    }

    const onUp = (e: MouseEvent) => {
      const { drawing, start, rectEl, canvas, pageN } = snapState.current
      if (!drawing) return
        snapState.current.drawing = false

        const wrap = rectEl?.parentElement as HTMLElement | null
        rectEl?.remove()
        snapState.current.rectEl = null

        if (!wrap || !canvas) return
          const pos = getPos(e, wrap)
          const w = Math.abs(pos.x - start.x)
          const h = Math.abs(pos.y - start.y)

          if (w > 8 && h > 8) {
            const dataUrl = captureArea(
              canvas,
              Math.min(start.x, pos.x),
                                        Math.min(start.y, pos.y),
                                        w, h, pageN
            )
            if (useLectioStore.getState().settings.autoSnap) {
              useLectioStore.getState().addMessage({
                id: `snap-${Date.now()}`,
                                                   role: 'user',
                                                   type: 'snap',
                                                   dataUrl,
                                                   pageN,
                                                   label: `Fragmento — p. ${pageN}`,
                                                   timestamp: Date.now(),
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

  const hasPdf = pdf.totalPages > 0
  const zoomLabel = Math.round(pdf.scale * 100) + '%'

  return (
    <div
    className="relative flex h-full flex-col"
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

    {/* ── Search button ── */}
    <button
      onClick={() => setSearchOpen((v) => !v)}
      title="Buscar papers (F)"
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] tracking-[.04em] transition-all ${
        searchOpen
          ? 'border-[#2a2a2a] bg-[#1a1a1a] text-[#ccc]'
          : 'border-transparent text-[#555] hover:border-[#2a2a2a] hover:bg-[#1a1a1a] hover:text-[#999]'
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      Buscar
    </button>
    </div>
    </div>

    {/* Viewport */}
    <div
    ref={viewportRefCallback}
    className="flex flex-col items-center px-5 py-6 pb-20"
    style={{
      position: 'absolute',
      top: 42,
      bottom: 0,
      left: 0,
      right: searchOpen ? 360 : 0,
      overflowY: 'auto',
      background: '#000',
      scrollbarWidth: 'thin',
      scrollbarColor: '#222 transparent',
      transition: 'right 0.2s ease',
    }}
    >
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
      </div>
    )}
    </div>

    {/* Floating nav */}
    {hasPdf && (
      <div
        className="absolute bottom-[18px] flex items-center gap-0.5 rounded-full border border-[#1f1f1f] bg-[#111] px-2 py-1.5 opacity-0 shadow-[0_6px_20px_rgba(0,0,0,.5)] transition-[opacity,left] hover:opacity-100"
        style={{ left: searchOpen ? 'calc(50% - 180px)' : '50%', transform: 'translateX(-50%)' }}
      >
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

    {/* Floating search panel */}
    {searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} />}

    {/* Shared file input used by ChatPanel's PDF open button */}
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
