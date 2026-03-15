import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type {
  Annotation, AnnotationTool, AnnotationColor,
  HighlightAnnotation, NoteAnnotation,
} from '@/types'
import { ANNOTATION_COLORS } from '@/types'

function uid() { return Math.random().toString(36).slice(2, 10) }

function setTextLayersSelectable(viewportEl: HTMLElement, selectable: boolean) {
  viewportEl.querySelectorAll<HTMLElement>('[id^="tl-"]').forEach(tl => {
    tl.style.pointerEvents = selectable ? 'all' : 'none'
    tl.style.userSelect   = selectable ? 'text'  : 'none'
    tl.querySelectorAll<HTMLElement>('span').forEach(span => {
      span.style.pointerEvents = selectable ? 'all' : 'none'
      span.style.userSelect   = selectable ? 'text'  : 'none'
    })
  })
}

function rectToNorm(r: DOMRect, pageEl: HTMLElement) {
  const pr = pageEl.getBoundingClientRect()
  const pw = pageEl.offsetWidth, ph = pageEl.offsetHeight
  if (!pw || !ph) return null
  const x = (r.left - pr.left) / pw, y = (r.top - pr.top) / ph
  const width = r.width / pw, height = r.height / ph
  if (width < 0.003 || height < 0.001) return null
  if (x + width < 0 || x > 1 || y + height < 0 || y > 1) return null
  return { x, y, width, height }
}

// ─── Selection toolbar (fixed, portal to body) ────────────────────────────────

interface SelectionData {
  text: string
  rects: DOMRect[]
  anchorX: number   // viewport coords for positioning
  anchorY: number
}

function SelectionToolbar({ sel, color, onHighlight, onAskAi, onClose }: {
  sel: SelectionData
  color: AnnotationColor
  onHighlight: (color: AnnotationColor) => void
  onAskAi:    (color: AnnotationColor) => void
  onClose: () => void
}) {
  const [activeColor, setActiveColor] = useState<AnnotationColor>(color)
  const [note, setNote] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Position: just above the anchor point
  const popW = 380, popH = 130
  const left = Math.min(Math.max(sel.anchorX - popW / 2, 8), window.innerWidth  - popW - 8)
  const top  = sel.anchorY - popH - 10 < 8
    ? sel.anchorY + 24
    : sel.anchorY - popH - 10

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    // slight delay so the mouseup that opened it doesn't close it immediately
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 80)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'Enter' && !e.altKey) { e.preventDefault(); onAskAi(activeColor) }
      if (e.key === 'Enter' &&  e.altKey) { e.preventDefault(); onHighlight(activeColor) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [activeColor, onHighlight, onAskAi, onClose])

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed', top, left, width: popW, zIndex: 9999,
        background: '#141414',
        border: '1px solid #2a2a2a',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,.8), 0 0 0 0.5px rgba(255,255,255,.04)',
        padding: '10px 12px 10px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      {/* Selected text preview */}
      <div style={{
        fontSize: 11, color: '#777', lineHeight: 1.5,
        maxHeight: 44, overflow: 'hidden',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        fontStyle: 'italic',
      }}>
        "{sel.text.slice(0, 160)}{sel.text.length > 160 ? '…' : ''}"
      </div>

      {/* Bottom row: colors + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Color swatches */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {ANNOTATION_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setActiveColor(c)}
              style={{
                width: 17, height: 17, borderRadius: '50%',
                background: c + '99',
                border: activeColor === c ? `2.5px solid ${c}` : '2.5px solid transparent',
                boxShadow: activeColor === c ? `0 0 0 1.5px #fff2` : 'none',
                cursor: 'pointer', outline: 'none', padding: 0,
                transition: 'transform .1s',
                transform: activeColor === c ? 'scale(1.18)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Highlight button */}
        <button
          onClick={() => onHighlight(activeColor)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            color: activeColor, fontSize: 11, fontWeight: 500,
            padding: '3px 0',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15.5 3.5 20.5 8.5l-11 11H4.5v-5L15.5 3.5z"/>
            <path d="M4 20h16" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Resaltar
          <span style={{ fontSize: 9, color: '#555', fontWeight: 400 }}>Alt+↵</span>
        </button>

        {/* Ask AI button */}
        <button
          onClick={() => onAskAi(activeColor)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#ccc', fontSize: 11, fontWeight: 500,
            padding: '3px 0',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            <path d="M20 3v4"/><path d="M22 5h-4"/>
          </svg>
          Preguntar
          <span style={{ fontSize: 9, color: '#555', fontWeight: 400 }}>↵</span>
        </button>

      </div>
    </div>,
    document.body
  )
}

// ─── Highlight edit popup (click on existing highlight) ───────────────────────

function HighlightEditPopup({ ann, pw, ph, onUpdate, onDelete, onClose }: {
  ann: HighlightAnnotation; pw: number; ph: number
  onUpdate: (p: Partial<HighlightAnnotation>) => void
  onDelete: () => void; onClose: () => void
}) {
  const cx = (ann.x + ann.width / 2) * pw
  const ty = ann.y * ph
  const popW = 186
  const left = Math.min(Math.max(cx - popW / 2, 4), pw - popW - 4)
  const top  = ty - 44 < 4 ? (ann.y + ann.height) * ph + 6 : ty - 44

  return (
    <foreignObject x={left} y={top} width={popW} height={38}
      style={{ overflow: 'visible', pointerEvents: 'all' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
        background: '#1c1c1c', border: '1px solid #2e2e2e', borderRadius: 9,
        boxShadow: '0 6px 20px rgba(0,0,0,.75)', width: popW, height: 34, boxSizing: 'border-box',
      }}>
        {ANNOTATION_COLORS.map(c => (
          <button key={c} onClick={() => { onUpdate({ color: c }); onClose() }}
            style={{
              width: 15, height: 15, borderRadius: '50%', background: c,
              border: ann.color === c ? '2.5px solid #fff' : '2.5px solid transparent',
              cursor: 'pointer', flexShrink: 0, outline: 'none', padding: 0,
            }} />
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => { onDelete(); onClose() }}
          style={{ color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#e55')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555')} title="Eliminar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3,6 5,6 21,6" />
            <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2" />
          </svg>
        </button>
      </div>
    </foreignObject>
  )
}

function HighlightRect({ ann, pw, ph, selected, onToggle, onUpdate, onDelete, onClose }: {
  ann: HighlightAnnotation; pw: number; ph: number; selected: boolean
  onToggle: () => void
  onUpdate: (p: Partial<HighlightAnnotation>) => void
  onDelete: () => void; onClose: () => void
}) {
  return (
    <g style={{ pointerEvents: 'all' }}>
      <rect
        x={ann.x * pw} y={ann.y * ph} width={ann.width * pw} height={ann.height * ph}
        fill={ann.color} fillOpacity={selected ? 0.5 : 0.28}
        stroke={selected ? ann.color : 'none'} strokeWidth={1.5} strokeOpacity={0.7}
        style={{ cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); onToggle() }}
      />
      {selected && (
        <HighlightEditPopup ann={ann} pw={pw} ph={ph}
          onUpdate={onUpdate} onDelete={onDelete} onClose={onClose} />
      )}
    </g>
  )
}

// ─── Note popup ───────────────────────────────────────────────────────────────

function NotePopup({ ann, pw, ph, open, onToggle, onClose, onUpdate, onDelete }: {
  ann: NoteAnnotation; pw: number; ph: number; open: boolean
  onToggle: () => void; onClose: () => void
  onUpdate: (p: Partial<NoteAnnotation>) => void; onDelete: () => void
}) {
  const [val, setVal] = useState(ann.text)
  useEffect(() => { if (open) setVal(ann.text) }, [open, ann.text])

  const commit = () => {
    const t = val.trim()
    if (!t) { onDelete(); return }
    onUpdate({ text: t }); onClose()
  }

  const x = ann.x * pw, y = ann.y * ph
  const popW = 224, popH = 162
  const popLeft = x + 26 + popW > pw ? x - popW - 6 : x + 26
  const popTop  = Math.min(Math.max(y - 10, 2), ph - popH - 2)

  return (
    <g style={{ pointerEvents: 'all' }}>
      <rect x={x} y={y} width={20} height={20} rx={4}
        fill={ann.color} fillOpacity={0.9}
        stroke={open ? '#fff' : 'none'} strokeWidth={1.5} strokeOpacity={0.6}
        style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onToggle() }} />
      <text x={x + 5} y={y + 14} fontSize={12} fill="#000"
        style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'sans-serif' }}>✎</text>

      {open && (
        <foreignObject x={popLeft} y={popTop} width={popW} height={popH}
          style={{ overflow: 'visible', zIndex: 50 }}>
          <div style={{
            background: '#141414', border: `1.5px solid ${ann.color}55`,
            borderRadius: 10, padding: 10, boxShadow: '0 8px 28px rgba(0,0,0,.85)',
            width: popW, boxSizing: 'border-box',
          }}>
            <textarea autoFocus value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
                if (e.key === 'Escape') onClose()
              }}
              placeholder="Escribe una nota…"
              style={{
                width: '100%', height: 76, resize: 'none', background: 'transparent',
                border: 'none', color: '#ddd', fontSize: 11.5, outline: 'none',
                fontFamily: '"IBM Plex Sans", sans-serif', display: 'block',
              }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              {ANNOTATION_COLORS.map(c => (
                <button key={c} onMouseDown={e => { e.preventDefault(); onUpdate({ color: c }) }}
                  style={{
                    width: 13, height: 13, borderRadius: '50%', background: c,
                    border: ann.color === c ? '2px solid #fff' : '2px solid transparent',
                    cursor: 'pointer', padding: 0, outline: 'none', flexShrink: 0,
                  }} />
              ))}
              <div style={{ flex: 1 }} />
              <button onMouseDown={e => { e.preventDefault(); onDelete() }}
                style={{ fontSize: 10, color: '#444', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#e55')}
                onMouseLeave={e => (e.currentTarget.style.color = '#444')}>eliminar</button>
              <button onMouseDown={e => { e.preventDefault(); commit() }}
                style={{
                  fontSize: 10, color: ann.color, background: ann.color + '1a',
                  border: 'none', cursor: 'pointer', borderRadius: 4, padding: '2px 7px',
                }}>guardar</button>
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  )
}

// ─── Per-page layer ───────────────────────────────────────────────────────────

function PageLayer({ page, pageEl, annotations, tool, color, selectedId, onSelect, onAdd, onUpdate, onDelete }: {
  page: number; pageEl: HTMLElement; annotations: Annotation[]
  tool: AnnotationTool; color: AnnotationColor
  selectedId: string | null; onSelect: (id: string | null) => void
  onAdd: (a: Annotation) => void
  onUpdate: (id: string, p: Partial<Annotation>) => void
  onDelete: (id: string) => void
}) {
  const pw = pageEl.offsetWidth, ph = pageEl.offsetHeight
  const highlights = annotations.filter(a => a.type === 'highlight') as HighlightAnnotation[]
  const notes      = annotations.filter(a => a.type === 'note')      as NoteAnnotation[]

  const handleNotePlacement = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    if (tool !== 'note') return
    e.preventDefault(); e.stopPropagation()
    const r = pageEl.getBoundingClientRect()
    const id = uid()
    onAdd({ id, type: 'note', page, color, createdAt: Date.now(),
      x: (e.clientX - r.left) / pw, y: (e.clientY - r.top) / ph, text: '' } as NoteAnnotation)
    onSelect(id)
  }, [tool, color, page, pageEl, pw, ph, onAdd, onSelect])

  return (
    <svg style={{
      position: 'absolute', top: 0, left: 0, width: pw, height: ph,
      zIndex: 5, pointerEvents: 'none', overflow: 'visible',
    }}>
      {tool === 'note' && (
        <rect x={0} y={0} width={pw} height={ph} fill="transparent"
          style={{ pointerEvents: 'all', cursor: 'cell' }}
          onClick={handleNotePlacement} />
      )}
      {highlights.map(a => (
        <HighlightRect key={a.id} ann={a} pw={pw} ph={ph}
          selected={selectedId === a.id}
          onToggle={() => onSelect(selectedId === a.id ? null : a.id)}
          onUpdate={p => onUpdate(a.id, p as Partial<Annotation>)}
          onDelete={() => { onDelete(a.id); onSelect(null) }}
          onClose={() => onSelect(null)} />
      ))}
      {notes.map(a => (
        <NotePopup key={a.id} ann={a} pw={pw} ph={ph}
          open={selectedId === a.id}
          onToggle={() => onSelect(selectedId === a.id ? null : a.id)}
          onClose={() => onSelect(null)}
          onUpdate={p => onUpdate(a.id, p as Partial<Annotation>)}
          onDelete={() => { onDelete(a.id); onSelect(null) }} />
      ))}
    </svg>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface AnnotationLayerProps {
  viewportEl: HTMLElement | null; totalPages: number; scale: number
  annotations: Annotation[]; tool: AnnotationTool; color: AnnotationColor
  onAdd:    (a: Annotation) => void
  onUpdate: (id: string, p: Partial<Annotation>) => void
  onDelete: (id: string) => void
}

export function AnnotationLayer({
  viewportEl, totalPages, scale,
  annotations, tool, color,
  onAdd, onUpdate, onDelete,
}: AnnotationLayerProps) {
  const [pageEls,    setPageEls]    = useState<Record<number, HTMLElement>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selection,  setSelection]  = useState<SelectionData | null>(null)
  const selectionColorRef = useRef<AnnotationColor>(color)

  // keep a ref in sync so toolbar callbacks always see latest color
  useEffect(() => { selectionColorRef.current = color }, [color])

  useEffect(() => { setSelectedId(null) }, [tool])

  // Close popup on background click
  useEffect(() => {
    if (!viewportEl) return
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t === viewportEl || t.classList.contains('page-wrap')) setSelectedId(null)
    }
    viewportEl.addEventListener('click', h)
    return () => viewportEl.removeEventListener('click', h)
  }, [viewportEl])

  // Discover page-wrap elements
  useEffect(() => {
    if (!viewportEl || !totalPages) return
    const measure = () => {
      const els: Record<number, HTMLElement> = {}
      viewportEl.querySelectorAll<HTMLElement>('.page-wrap').forEach(el => {
        const n = parseInt(el.id.replace('pw-', ''))
        if (n) els[n] = el
      })
      setPageEls(els)
    }
    const t = setTimeout(measure, 150)
    return () => clearTimeout(t)
  }, [viewportEl, totalPages, scale])

  // Always keep text layers selectable
  useEffect(() => {
    if (!viewportEl) return
    setTextLayersSelectable(viewportEl, true)
  }, [viewportEl, totalPages, scale])

  // Extract annotation geometry from a selection
  const buildAnnotations = useCallback((
    selText: string, range: Range, chosenColor: AnnotationColor,
  ): HighlightAnnotation[] => {
    const rects = Array.from(range.getClientRects())
    const byPage = new Map<HTMLElement, DOMRect[]>()
    for (const rect of rects) {
      for (const pageEl of Object.values(pageEls)) {
        const pr = pageEl.getBoundingClientRect()
        if (rect.left >= pr.left - 5 && rect.right <= pr.right + 5 &&
            rect.top >= pr.top - 5  && rect.bottom <= pr.bottom + 5) {
          if (!byPage.has(pageEl)) byPage.set(pageEl, [])
          byPage.get(pageEl)!.push(rect)
          break
        }
      }
    }

    const created: HighlightAnnotation[] = []
    byPage.forEach((pageRects, pageEl) => {
      const n = parseInt(pageEl.id.replace('pw-', ''))
      const u = pageRects.reduce(
        (a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
      )
      const norm = rectToNorm(new DOMRect(u.left, u.top, u.right - u.left, u.bottom - u.top), pageEl)
      if (!norm) return
      created.push({ id: uid(), type: 'highlight', page: n, color: chosenColor, createdAt: Date.now(), text: selText.slice(0, 600), ...norm })
    })
    return created
  }, [pageEls])

  // Saved range ref so we can re-use it after toolbar renders
  const savedRangeRef = useRef<Range | null>(null)

  // mouseup → show toolbar if there's a selection within text layers
  useEffect(() => {
    if (!viewportEl) return
    const onMouseUp = (e: MouseEvent) => {
      // Don't fire if click was inside an existing SVG annotation popup
      if ((e.target as HTMLElement).closest('foreignObject')) return

      setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return

        const text = sel.toString().replace(/\s+/g, ' ').trim()
        if (!text || text.length < 2) return

        // Check that the selection is inside a text layer
        const range = sel.getRangeAt(0)
        const container = range.commonAncestorContainer
        const tl = (container instanceof HTMLElement ? container : container.parentElement)
          ?.closest('[id^="tl-"]')
        if (!tl) return

        savedRangeRef.current = range.cloneRange()

        // Anchor below the selection for the toolbar
        const rects = Array.from(range.getClientRects())
        if (!rects.length) return
        const bottom = Math.max(...rects.map(r => r.bottom))
        const cx     = (Math.min(...rects.map(r => r.left)) + Math.max(...rects.map(r => r.right))) / 2

        setSelection({ text, rects, anchorX: cx, anchorY: bottom })
      }, 20)
    }

    viewportEl.addEventListener('mouseup', onMouseUp)
    return () => viewportEl.removeEventListener('mouseup', onMouseUp)
  }, [viewportEl, pageEls])

  // Highlight action
  const handleHighlight = useCallback((chosenColor: AnnotationColor) => {
    const range = savedRangeRef.current
    const text  = selection?.text ?? ''
    if (!range || !text) { setSelection(null); return }

    const anns = buildAnnotations(text, range, chosenColor)
    anns.forEach(a => onAdd(a))
    window.getSelection()?.removeAllRanges()
    setSelection(null)
  }, [selection, buildAnnotations, onAdd])

  // Ask AI action — highlights + injects text into chat input
  const handleAskAi = useCallback((chosenColor: AnnotationColor) => {
    const range = savedRangeRef.current
    const text  = selection?.text ?? ''
    if (!text) { setSelection(null); return }

    // Create highlight first
    if (range) {
      const anns = buildAnnotations(text, range, chosenColor)
      anns.forEach(a => onAdd(a))
    }

    // Inject into chat
    window.dispatchEvent(new CustomEvent('lectio:inject-text', { detail: { text } }))

    window.getSelection()?.removeAllRanges()
    setSelection(null)
  }, [selection, buildAnnotations, onAdd])

  return (
    <>
      {Object.entries(pageEls).map(([pageStr, el]) => {
        const pageN = parseInt(pageStr)
        return createPortal(
          <PageLayer key={pageN} page={pageN} pageEl={el}
            annotations={annotations.filter(a => a.page === pageN)}
            tool={tool} color={color} selectedId={selectedId} onSelect={setSelectedId}
            onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} />,
          el
        )
      })}

      {selection && (
        <SelectionToolbar
          sel={selection}
          color={color}
          onHighlight={handleHighlight}
          onAskAi={handleAskAi}
          onClose={() => { setSelection(null); window.getSelection()?.removeAllRanges() }}
        />
      )}
    </>
  )
}
