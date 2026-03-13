import { useLectioStore } from '@/store'
import type { AnnotationTool, AnnotationColor } from '@/types'

const TOOLS: { id: AnnotationTool; label: string; icon: React.ReactNode }[] = [
    {
        id: 'highlight',
        label: 'Resaltar (arrastra sobre el texto)',
        icon: (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="14" width="18" height="7" rx="1" opacity={0.35} />
            <rect x="3" y="3" width="18" height="9" rx="1" opacity={0.9} />
            </svg>
        ),
    },
{
    id: 'note',
    label: 'Nota (clic para colocar)',
    icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="12" y2="17" />
        </svg>
    ),
},
]

const COLORS: AnnotationColor[] = ['#FFD60A', '#30D158', '#FF6369', '#64D2FF', '#BF5AF2']

export function AnnotationToolbar() {
    const { annotations, setAnnotationTool, setAnnotationColor } = useLectioStore()
    const { tool, color } = annotations

    const toggle = (t: AnnotationTool) => setAnnotationTool(tool === t ? 'none' : t)

    return (
        <div className="flex items-center gap-1">
        {TOOLS.map((t) => (
            <button
            key={t.id}
            onClick={() => toggle(t.id)}
            title={t.label}
            className={`flex h-7 w-7 items-center justify-center rounded-md border transition-all ${
                tool === t.id
                ? 'border-transparent bg-white text-black'
                : 'border-transparent text-[#555] hover:border-[#2a2a2a] hover:bg-[#1a1a1a] hover:text-[#999]'
            }`}
            >
            {t.icon}
            </button>
        ))}

        <div className="mx-0.5 h-4 w-px bg-[#1e1e1e]" />

        {COLORS.map((c) => (
            <button
            key={c}
            onClick={() => setAnnotationColor(c)}
            title={c}
            style={{ background: c }}
            className={`h-[13px] w-[13px] flex-shrink-0 rounded-full transition-all ${
                color === c
                ? 'ring-2 ring-white ring-offset-1 ring-offset-[#0d0d0d]'
                : 'opacity-50 hover:opacity-90'
            }`}
            />
        ))}
        </div>
    )
}
