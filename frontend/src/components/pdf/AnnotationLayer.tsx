import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type {
    Annotation,
    AnnotationTool,
    AnnotationColor,
    HighlightAnnotation,
    NoteAnnotation,
} from '@/types'

function uid() {
    return Math.random().toString(36).slice(2, 10)
}

// ─── Toggle text layer selectability ─────────────────────────────────────────

function setTextLayersSelectable(viewportEl: HTMLElement, selectable: boolean) {
    // Match by class (new) or by id prefix (legacy)
    viewportEl.querySelectorAll<HTMLElement>('.text-layer, [id^="tl-"]').forEach((tl) => {
        tl.style.pointerEvents = selectable ? 'none' : 'none' // container always none
    tl.querySelectorAll<HTMLElement>('span').forEach((span) => {
        span.style.pointerEvents = selectable ? 'auto' : 'none'
        span.style.userSelect = selectable ? 'text' : 'none'
        span.style.cursor = selectable ? 'text' : 'default'
    })
    })
}

// ─── Convert a ClientRect to normalized coords within a page-wrap ─────────────

function rectToNorm(
    clientRect: DOMRect,
    pageEl: HTMLElement
): { x: number; y: number; width: number; height: number } | null {
    const pr = pageEl.getBoundingClientRect()
    const pw = pageEl.offsetWidth
    const ph = pageEl.offsetHeight
    if (pw === 0 || ph === 0) return null

        const x = (clientRect.left - pr.left) / pw
        const y = (clientRect.top - pr.top) / ph
        const width = clientRect.width / pw
        const height = clientRect.height / ph

        // Discard rects that are outside the page or too small
        if (width < 0.005 || height < 0.002) return null
            if (x + width < 0 || x > 1 || y + height < 0 || y > 1) return null

                return { x, y, width, height }
}

// ─── Find which page-wrap a DOM node belongs to ───────────────────────────────

function getPageWrap(node: Node): { el: HTMLElement; pageN: number } | null {
    let el = node instanceof HTMLElement ? node : node.parentElement
    while (el) {
        if (el.classList.contains('page-wrap')) {
            const n = parseInt(el.id.replace('pw-', ''))
            if (n) return { el, pageN: n }
        }
        el = el.parentElement
    }
    return null
}

// ─── Note popup ───────────────────────────────────────────────────────────────

function NotePopup({ ann, pw, ph, onUpdate, onDelete }: {
    ann: NoteAnnotation
    pw: number
    ph: number
    onUpdate: (text: string) => void
    onDelete: () => void
}) {
    const [open, setOpen] = useState(!ann.text)
    const [val, setVal] = useState(ann.text)
    const x = ann.x * pw
    const y = ann.y * ph
    const popupLeft = x + 22 + 200 > pw ? x - 210 : x + 22

    const commit = () => {
        const trimmed = val.trim()
        if (!trimmed) { onDelete(); return }
        onUpdate(trimmed)
        setOpen(false)
    }

    return (
        <g style={{ pointerEvents: 'all' }}>
        <rect
        x={x} y={y} width={18} height={18} rx={3}
        fill={ann.color} fillOpacity={0.9}
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen(v => !v)}
        onDoubleClick={onDelete}
        />
        <text x={x + 4} y={y + 13} fontSize={11} fill="#000"
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        ✎
        </text>
        {open && (
            <foreignObject x={popupLeft} y={y} width={200} height={130} style={{ overflow: 'visible' }}>
            <div style={{
                background: '#111', border: `1.5px solid ${ann.color}`,
                borderRadius: 6, padding: 6, boxShadow: '0 4px 20px rgba(0,0,0,.8)', width: 200,
            }}>
            <textarea
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() } }}
            placeholder="Escribe una nota…"
            style={{
                width: '100%', height: 72, resize: 'none', background: 'transparent',
                border: 'none', color: '#ddd', fontSize: 11, outline: 'none',
                fontFamily: 'IBM Plex Sans, sans-serif', display: 'block',
            }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
            <button
            onMouseDown={e => { e.preventDefault(); onDelete() }}
            style={{ fontSize: 10, color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}
            >eliminar</button>
            <button
            onMouseDown={e => { e.preventDefault(); commit() }}
            style={{ fontSize: 10, color: ann.color, background: 'none', border: 'none', cursor: 'pointer' }}
            >guardar</button>
            </div>
            </div>
            </foreignObject>
        )}
        </g>
    )
}

// ─── Per-page SVG layer (only for notes — highlights come from selection) ─────

interface NoteLayerProps {
    page: number
    pageEl: HTMLElement
    annotations: Annotation[]
    tool: AnnotationTool
    color: AnnotationColor
    onAdd: (ann: Annotation) => void
    onUpdate: (id: string, patch: Partial<Annotation>) => void
    onDelete: (id: string) => void
}

function NoteLayer({ page, pageEl, annotations, tool, color, onAdd, onUpdate, onDelete }: NoteLayerProps) {
    const pw = pageEl.offsetWidth
    const ph = pageEl.offsetHeight

    const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (tool !== 'note') return
            e.preventDefault()
            e.stopPropagation()
            const rect = pageEl.getBoundingClientRect()
            const nx = (e.clientX - rect.left) / pw
            const ny = (e.clientY - rect.top) / ph
            onAdd({ id: uid(), type: 'note', page, color, createdAt: Date.now(), x: nx, y: ny, text: '' } as NoteAnnotation)
    }, [tool, color, page, pageEl, pw, ph, onAdd])

    return (
        <svg
        style={{
            position: 'absolute', top: 0, left: 0,
            width: pw, height: ph, zIndex: 5,
            pointerEvents: tool === 'note' ? 'all' : 'none',
            overflow: 'visible',
            cursor: tool === 'note' ? 'cell' : 'default',
        }}
        onClick={handleClick}
        >
        {/* Highlight rects */}
        {annotations.filter(a => a.type === 'highlight').map(ann => {
            const a = ann as HighlightAnnotation
            return (
                <rect key={a.id}
                x={a.x * pw} y={a.y * ph}
                width={a.width * pw} height={a.height * ph}
                fill={a.color} fillOpacity={0.3}
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
                onDoubleClick={() => onDelete(a.id)}
                />
            )
        })}

        {/* Note pins */}
        {annotations.filter(a => a.type === 'note').map(ann => (
            <NotePopup
            key={ann.id}
            ann={ann as NoteAnnotation}
            pw={pw} ph={ph}
            onUpdate={text => onUpdate(ann.id, { text } as any)}
            onDelete={() => onDelete(ann.id)}
            />
        ))}
        </svg>
    )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface AnnotationLayerProps {
    viewportEl: HTMLElement | null
    totalPages: number
    scale: number
    annotations: Annotation[]
    tool: AnnotationTool
    color: AnnotationColor
    onAdd: (ann: Annotation) => void
    onUpdate: (id: string, patch: Partial<Annotation>) => void
    onDelete: (id: string) => void
}

export function AnnotationLayer({
    viewportEl, totalPages, scale,
    annotations, tool, color, onAdd, onUpdate, onDelete,
}: AnnotationLayerProps) {
    const [pageEls, setPageEls] = useState<Record<number, HTMLElement>>({})

    // Discover page-wrap elements after render / zoom change
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

    // Toggle text layer selectability based on tool
    useEffect(() => {
        if (!viewportEl) return
            setTextLayersSelectable(viewportEl, tool === 'highlight')
            return () => {
                // Clean up selection when switching away
                if (tool === 'highlight') window.getSelection()?.removeAllRanges()
            }
    }, [viewportEl, tool])

    // Handle text selection → highlight annotations
    useEffect(() => {
        if (!viewportEl || tool !== 'highlight') return

            const onMouseUp = (e: MouseEvent) => {
                setTimeout(() => {
                    const sel = window.getSelection()
                    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return

                        const range = sel.getRangeAt(0)
                        const rects = Array.from(range.getClientRects()).filter(r => r.width > 2 && r.height > 2)
                        if (rects.length === 0) return

                            // Group rects by page
                            const byPage = new Map<HTMLElement, DOMRect[]>()
                            for (const rect of rects) {
                                for (const pageEl of Object.values(pageEls)) {
                                    const pr = pageEl.getBoundingClientRect()
                                    if (
                                        rect.left >= pr.left - 5 && rect.right <= pr.right + 5 &&
                                        rect.top >= pr.top - 5 && rect.bottom <= pr.bottom + 5
                                    ) {
                                        if (!byPage.has(pageEl)) byPage.set(pageEl, [])
                                            byPage.get(pageEl)!.push(rect)
                                            break
                                    }
                                }
                            }

                            byPage.forEach((pageRects, pageEl) => {
                                const n = parseInt(pageEl.id.replace('pw-', ''))

                                // Merge rects on the same visual line (within 4px vertically)
                                const sorted = [...pageRects].sort((a, b) => a.top - b.top || a.left - b.left)
                                const merged: { top: number; bottom: number; left: number; right: number }[] = []

                                for (const r of sorted) {
                                    const last = merged[merged.length - 1]
                                    if (last && r.top < last.bottom + 4 && r.bottom > last.top - 4) {
                                        // Same line — extend the band
                                        last.left = Math.min(last.left, r.left)
                                        last.right = Math.max(last.right, r.right)
                                        last.top = Math.min(last.top, r.top)
                                        last.bottom = Math.max(last.bottom, r.bottom)
                                    } else {
                                        merged.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })
                                    }
                                }

                                const pr = pageEl.getBoundingClientRect()
                                const pw = pageEl.offsetWidth
                                const ph = pageEl.offsetHeight
                                if (pw === 0 || ph === 0) return

                                    for (const m of merged) {
                                        const x = (m.left - pr.left) / pw
                                        const y = (m.top - pr.top) / ph
                                        const width = (m.right - m.left) / pw
                                        const height = (m.bottom - m.top) / ph
                                        if (width < 0.005 || height < 0.002) continue
                                            onAdd({
                                                id: uid(), type: 'highlight', page: n,
                                                  color, createdAt: Date.now(),
                                                  x, y, width, height,
                                            } as HighlightAnnotation)
                                    }
                            })

                            sel.removeAllRanges()
                }, 10)
            }

            viewportEl.addEventListener('mouseup', onMouseUp)
            return () => viewportEl.removeEventListener('mouseup', onMouseUp)
    }, [viewportEl, tool, color, pageEls, onAdd])

    return (
        <>
        {Object.entries(pageEls).map(([pageStr, el]) => {
            const pageN = parseInt(pageStr)
            return createPortal(
                <NoteLayer
                key={pageN}
                page={pageN}
                pageEl={el}
                annotations={annotations.filter(a => a.page === pageN)}
                tool={tool}
                color={color}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onDelete={onDelete}
                />,
                el
            )
        })}
        </>
    )
}
