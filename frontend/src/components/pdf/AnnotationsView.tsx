import { useState, useCallback } from 'react'
import { useAnnotations } from '@/hooks/useAnnotations'
import { useLectioStore } from '@/store'
import { exportAnnotationsMarkdown, exportAnnotationsBibTeX } from '@/lib/pdf/export-annotations'
import type { NoteAnnotation } from '@/types'

type Filter = 'all' | 'highlight' | 'note'

function pad(n: number) { return String(n).padStart(2, '0') }

export function AnnotationsView() {
    const [filter, setFilter] = useState<Filter>('all')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editVal, setEditVal] = useState('')
    const ann = useAnnotations()
    const { pdf } = useLectioStore()

    const items = filter === 'all'
    ? ann.allAnnotations
    : ann.allAnnotations.filter(a => a.type === filter)

    const sorted = [...items].sort((a, b) => a.page - b.page || a.createdAt - b.createdAt)

    const goTo = useCallback((page: number) => {
        useLectioStore.getState().setPdfPage(page)
    }, [])

    const startEdit = (id: string, text: string) => {
        setEditingId(id)
        setEditVal(text)
    }

    const commitEdit = () => {
        if (!editingId) return
            const t = editVal.trim()
            if (t) ann.update(editingId, { text: t } as Partial<NoteAnnotation>)
                else ann.remove(editingId)
                    setEditingId(null)
    }

    const counts = {
        all: ann.allAnnotations.length,
        highlight: ann.allAnnotations.filter(a => a.type === 'highlight').length,
        note: ann.allAnnotations.filter(a => a.type === 'note').length,
    }

    if (!pdf.name) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-[#1e1e1e]">
            <path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
            </svg>
            <p className="text-[12px] font-medium text-[#2a2a2a]">Sin documento</p>
            <p className="text-[10px] leading-relaxed text-[#1c1c1c]">Abre un PDF para<br />empezar a anotar.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden min-h-0">

        {/* Filter bar + export */}
        <div className="flex flex-shrink-0 items-center gap-1 px-2 py-2">
        {(['all', 'highlight', 'note'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                filter === f ? 'bg-[#1e1e1e] text-[#ccc]' : 'text-[#333] hover:text-[#666]'
            }`}>
            {f === 'all' ? 'Todas' : f === 'highlight' ? 'Resaltados' : 'Notas'}
            {counts[f] > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    filter === f ? 'bg-[#2a2a2a] text-[#777]' : 'text-[#2a2a2a]'
                }`}>{counts[f]}</span>
            )}
            </button>
        ))}

        {/* Export buttons */}
        {ann.allAnnotations.length > 0 && (
            <div className="ml-auto flex gap-1">
            <button
            onClick={() => exportAnnotationsMarkdown(ann.allAnnotations, pdf.name)}
            title="Exportar como Markdown"
            className="rounded px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-[#2e2e2e] transition-colors hover:bg-[#1a1a1a] hover:text-[#888]"
            >.md</button>
            <button
            onClick={() => exportAnnotationsBibTeX(ann.allAnnotations, pdf.name)}
            title="Exportar como BibTeX"
            className="rounded px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-[#2e2e2e] transition-colors hover:bg-[#1a1a1a] hover:text-[#888]"
            >.bib</button>
            </div>
        )}
        </div>

        {/* List */}
        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2a2a transparent' }}>

        {sorted.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-[#222]">
            <path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
            </svg>
            <p className="text-[12px] font-medium text-[#2e2e2e]">Sin anotaciones</p>
            <p className="text-[10px] leading-relaxed text-[#222]">
            Usa las herramientas del visor<br />para resaltar o añadir notas.
            </p>
            </div>
        )}

        {sorted.map(item => {
            const ts = new Date(item.createdAt)
            const time = `${pad(ts.getHours())}:${pad(ts.getMinutes())}`
            const color = item.color
            const isEditing = editingId === item.id

            return (
                <div key={item.id}
                onClick={() => goTo(item.page)}
                className="group relative flex cursor-pointer flex-col gap-1 rounded-[9px] border border-[#1a1a1a] bg-[#111] p-2.5 transition-colors hover:border-[#2a2a2a]"
                >
                {/* Header */}
                <div className="flex items-center gap-1.5">
                <span
                className="flex h-[18px] items-center gap-1 rounded-full px-[7px] text-[9px] font-semibold uppercase tracking-[.08em]"
                style={{ background: color + '1a', color }}
                >
                {item.type === 'highlight' ? (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15.5 3.5 20.5 8.5l-11 11H4.5v-5L15.5 3.5z"/>
                    </svg>
                ) : (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                )}
                {item.type === 'highlight' ? 'Resaltado' : 'Nota'}
                </span>

                <span className="ml-auto text-[10px] text-[#333]">p. {item.page}</span>

                {/* Edit button (notes only) */}
                {item.type === 'note' && !isEditing && (
                    <button
                    onClick={e => { e.stopPropagation(); startEdit(item.id, (item as any).text ?? '') }}
                    className="flex h-[18px] w-[18px] items-center justify-center rounded opacity-0 transition-all hover:bg-[#1a1a1a] hover:text-[#888] group-hover:opacity-100 text-[#2a2a2a]"
                    title="Editar"
                    >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    </button>
                )}

                {/* Delete */}
                <button
                onClick={e => { e.stopPropagation(); ann.remove(item.id) }}
                className="flex h-[18px] w-[18px] items-center justify-center rounded opacity-0 transition-all hover:bg-[#1a1a1a] hover:text-[#e55] group-hover:opacity-100 text-[#2a2a2a]"
                title="Eliminar"
                >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                </button>
                </div>

                {/* Highlight quote */}
                {'text' in item && (item as any).text && item.type === 'highlight' && (
                    <div className="rounded-[5px] px-2 py-1.5 text-[11px] leading-relaxed text-[#666]"
                    style={{ background: '#0d0d0d', borderLeft: `2px solid ${color}55` }}>
                    {(item as any).text}
                    </div>
                )}

                {/* Note text (view or edit) */}
                {item.type === 'note' && (
                    isEditing ? (
                        <div onClick={e => e.stopPropagation()} className="flex flex-col gap-1.5">
                        <textarea
                        autoFocus
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() }
                            if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="w-full resize-none rounded-[5px] border border-[#2a2a2a] bg-[#0d0d0d] px-2 py-1.5 text-[11px] leading-relaxed text-[#ccc] outline-none"
                        rows={3}
                        />
                        <div className="flex justify-end gap-1.5">
                        <button onClick={() => setEditingId(null)}
                        className="rounded px-2 py-0.5 text-[10px] text-[#333] hover:text-[#666]">cancelar</button>
                        <button onClick={commitEdit}
                        className="rounded px-2 py-0.5 text-[10px] font-medium"
                        style={{ color, background: color + '1a' }}>guardar</button>
                        </div>
                        </div>
                    ) : (item as any).text ? (
                        <div className="rounded-[5px] px-2 py-1.5 text-[11px] leading-relaxed text-[#777]"
                        style={{ background: '#0d0d0d', borderLeft: `2px solid ${color}66` }}>
                        {(item as any).text}
                        </div>
                    ) : null
                )}

                <div className="text-[9.5px] text-[#222]">{time}</div>
                </div>
            )
        })}
        </div>
        </div>
    )
}
