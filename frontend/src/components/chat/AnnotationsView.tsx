import { useState, useCallback } from 'react'
import { useAnnotations } from '@/hooks/useAnnotations'
import { useLectioStore } from '@/store'
import type { AnnotationTool } from '@/types'

type Filter = 'all' | 'highlight' | 'note'

const TYPE_LABELS: Record<string, string> = { highlight: 'Resaltado', note: 'Nota' }
const TYPE_COLORS: Record<string, string> = {
    highlight: '#e8c84a',
    note: '#b07ee8',
}

function pad(n: number) { return String(n).padStart(2, '0') }

export function AnnotationsView() {
    const [filter, setFilter] = useState<Filter>('all')
    const ann = useAnnotations()
    const { setPdfPage } = useLectioStore()

    const items = filter === 'all'
    ? ann.allAnnotations
    : ann.allAnnotations.filter(a => a.type === filter)

    const sorted = [...items].sort((a, b) => a.page - b.page || a.createdAt - b.createdAt)

    const goTo = useCallback((page: number) => {
        useLectioStore.getState().setPdfPage(page)
    }, [])

    if (!useLectioStore.getState().pdf.name) {
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
        {/* Filter bar */}
        <div className="flex flex-shrink-0 gap-1 px-2 py-2">
        {(['all', 'highlight', 'note'] as Filter[]).map(f => (
            <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-[10px] font-medium transition-all ${
                filter === f
                ? 'border-[#2a2a2a] bg-[#111] text-[#888]'
                : 'border-transparent text-[#2e2e2e] hover:text-[#666]'
            }`}
            >
            {f !== 'all' && (
                <span
                className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
                style={{ background: TYPE_COLORS[f] }}
                />
            )}
            {f === 'all' ? 'Todas' : TYPE_LABELS[f]}
            </button>
        ))}
        <span className="ml-auto flex items-center text-[9.5px] text-[#252525]">
        {sorted.length}
        </span>
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
            const color = TYPE_COLORS[item.type] ?? '#888'

        return (
            <div
            key={item.id}
            onClick={() => goTo(item.page)}
            className="group relative flex cursor-pointer flex-col gap-1 rounded-[9px] border border-[#1a1a1a] bg-[#111] p-2.5 transition-colors hover:border-[#2a2a2a]"
            >
            {/* Header */}
            <div className="flex items-center gap-1.5">
            <span
            className="flex h-[18px] items-center gap-1 rounded-full px-[7px] text-[9px] font-semibold uppercase tracking-[.08em]"
            style={{
                background: color + '1a',
                color,
            }}
            >
            {item.type === 'highlight' ? (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
                </svg>
            ) : (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
            )}
            {TYPE_LABELS[item.type]}
            </span>
            <span className="ml-auto text-[10px] text-[#333]">p. {item.page}</span>
            <button
            onClick={e => { e.stopPropagation(); ann.remove(item.id) }}
            className="flex h-[18px] w-[18px] items-center justify-center rounded opacity-0 transition-all hover:bg-[#1a1a1a] hover:text-[#888] group-hover:opacity-100 text-[#2a2a2a]"
            >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            </button>
            </div>

            {/* Note text */}
            {'text' in item && item.text && item.type === 'note' && (
                <div
                className="rounded-[5px] px-2 py-1.5 text-[11px] leading-relaxed text-[#777]"
                style={{
                    background: '#0d0d0d',
                    borderLeft: `2px solid ${color}66`,
                }}
                >
                {(item as any).text}
                </div>
            )}

            <div className="text-[9.5px] text-[#222]">{time}</div>
            </div>
        )
        })}
        </div>
        </div>
    )
}
