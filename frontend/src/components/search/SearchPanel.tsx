import { useState, useEffect, useRef, useCallback } from 'react'
import { useLectioStore } from '@/store'
import { searchArxiv, searchScholar, philPapersUrl } from '@/lib/search'
import type { SearchResult, SearchSource } from '@/lib/search'

// ─── Source config ────────────────────────────────────────────────────────────

const SOURCES: { id: SearchSource; label: string; color: string }[] = [
  { id: 'arxiv',      label: 'arXiv',   color: '#b5451b' },
  { id: 'scholar',    label: 'Scholar', color: '#4a8cc7' },
  { id: 'philpapers', label: 'Phil',    color: '#7c6ca8' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortAuthors(authors: string[]): string {
  if (!authors.length) return ''
  if (authors.length === 1) return authors[0].split(' ').pop() ?? authors[0]
  if (authors.length === 2)
    return authors.map((a) => a.split(' ').pop()).join(', ')
  return `${authors[0].split(' ').pop()} et al.`
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

// ─── Result Card ─────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: SearchResult }) {
  const src = SOURCES.find((s) => s.id === result.source)!
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="group rounded-lg border border-[#1c1c1c] bg-[#0e0e0e] p-3 transition-colors hover:border-[#2a2a2a]">
      {/* Source badge + year */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className="rounded-sm px-1 py-px font-mono text-[9px] uppercase tracking-wider"
          style={{ background: src.color + '22', color: src.color }}
        >
          {src.label}
        </span>
        {result.year && (
          <span className="font-mono text-[10px] text-[#444]">{result.year}</span>
        )}
        <div className="flex-1" />
        {/* Action buttons */}
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir página"
          className="flex h-[20px] w-[20px] items-center justify-center rounded text-[#333] transition-colors hover:bg-[#1a1a1a] hover:text-[#bbb]"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15,3 21,3 21,9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
        {result.pdfUrl && (
          <a
            href={result.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir PDF"
            className="flex h-[20px] w-[20px] items-center justify-center rounded text-[#333] transition-colors hover:bg-[#1a1a1a] hover:text-[#bbb]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
            </svg>
          </a>
        )}
      </div>

      {/* Title */}
      <div className="mb-1 text-[12px] font-medium leading-tight text-[#ccc]">
        {truncate(result.title, 120)}
      </div>

      {/* Authors */}
      {result.authors.length > 0 && (
        <div className="mb-1.5 font-mono text-[10px] text-[#444]">
          {shortAuthors(result.authors)}
        </div>
      )}

      {/* Abstract — collapsible */}
      {result.abstract && (
        <div>
          <div className={`text-[11px] leading-relaxed text-[#555] ${!expanded ? 'line-clamp-2' : ''}`}>
            {result.abstract}
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 font-mono text-[10px] text-[#333] transition-colors hover:text-[#888]"
          >
            {expanded ? 'menos ↑' : 'más ↓'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── PhilPapers placeholder card ─────────────────────────────────────────────

function PhilCard({ query }: { query: string }) {
  return (
    <a
      href={philPapersUrl(query)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-[#1c1c1c] bg-[#0e0e0e] p-3 transition-colors hover:border-[#2a2a2a]"
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[#7c6ca8]/10">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c6ca8" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <path d="M7 8 Q12 12 17 8" />
          <path d="M7 16 Q12 12 17 16" />
        </svg>
      </div>
      <div>
        <div className="text-[12px] font-medium text-[#aaa]">Buscar en PhilPapers</div>
        <div className="font-mono text-[10px] text-[#444]">
          "{truncate(query, 40)}" → philpapers.org ↗
        </div>
      </div>
    </a>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[#1c1c1c] bg-[#0e0e0e] p-3">
      <div className="mb-2 h-2 w-12 animate-pulse rounded bg-[#1a1a1a]" />
      <div className="mb-1.5 h-3 w-full animate-pulse rounded bg-[#1a1a1a]" />
      <div className="mb-1 h-3 w-3/4 animate-pulse rounded bg-[#1a1a1a]" />
      <div className="h-2 w-1/3 animate-pulse rounded bg-[#1a1a1a]" />
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface SearchPanelProps {
  onClose: () => void
}

type Status = 'idle' | 'loading' | 'done' | 'error'

export function SearchPanel({ onClose }: SearchPanelProps) {
  const { pdf } = useLectioStore()

  // Pre-populate from doc themes
  const initialQuery = pdf.index.themes.slice(0, 3).join(' ') || pdf.name.replace(/\.pdf$/i, '')
  const [query, setQuery] = useState(initialQuery)
  const [activeSource, setActiveSource] = useState<SearchSource>('arxiv')
  const [results, setResults] = useState<Record<SearchSource, SearchResult[]>>({
    arxiv: [],
    scholar: [],
    philpapers: [],
  })
  const [status, setStatus] = useState<Record<SearchSource, Status>>({
    arxiv: 'idle',
    scholar: 'idle',
    philpapers: 'idle',
  })
  const [error, setError] = useState<Record<SearchSource, string>>({
    arxiv: '',
    scholar: '',
    philpapers: '',
  })

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const runSearch = useCallback(async (q: string, source: SearchSource) => {
    if (!q.trim()) return
    if (source === 'philpapers') return // PhilPapers is link-only

    setStatus((s) => ({ ...s, [source]: 'loading' }))
    setError((s) => ({ ...s, [source]: '' }))

    try {
      let items: SearchResult[] = []
      if (source === 'arxiv') items = await searchArxiv(q, 10)
      if (source === 'scholar') items = await searchScholar(q, 10)
      setResults((s) => ({ ...s, [source]: items }))
      setStatus((s) => ({ ...s, [source]: 'done' }))
    } catch (err: any) {
      setStatus((s) => ({ ...s, [source]: 'error' }))
      setError((s) => ({ ...s, [source]: err.message }))
    }
  }, [])

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (activeSource !== 'philpapers') runSearch(query, activeSource)
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, activeSource, runSearch])

  // Search when switching sources (if no results yet)
  const handleSourceChange = (src: SearchSource) => {
    setActiveSource(src)
    if (src !== 'philpapers' && results[src].length === 0 && status[src] === 'idle') {
      runSearch(query, src)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (activeSource !== 'philpapers') runSearch(query, activeSource)
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const currentStatus = status[activeSource]
  const currentResults = results[activeSource]
  const currentError = error[activeSource]

  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-30 flex w-[360px] flex-col border-l border-[#1a1a1a] bg-[#080808]/95"
      style={{ backdropFilter: 'blur(12px)' }}
    >
      {/* Header */}
      <div className="flex h-[42px] flex-shrink-0 items-center gap-2 border-b border-[#1a1a1a] px-3">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className="font-mono text-[11px] uppercase tracking-widest text-[#333]">Búsqueda</span>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-[#444] transition-colors hover:bg-[#1a1a1a] hover:text-[#ccc]"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Search input */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 border-b border-[#1a1a1a] px-3 py-2">
        <div className="flex items-center gap-2 rounded-[8px] border border-[#1f1f1f] bg-[#0e0e0e] px-2.5 py-1.5 focus-within:border-[#333]">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar papers…"
            className="flex-1 bg-transparent font-sans text-[12.5px] text-[#ccc] outline-none placeholder:text-[#2a2a2a]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[14px] leading-none text-[#333] transition-colors hover:text-[#888]"
            >
              ×
            </button>
          )}
        </div>
      </form>

      {/* Source tabs */}
      <div className="flex flex-shrink-0 gap-0.5 border-b border-[#1a1a1a] px-3 py-1.5">
        {SOURCES.map((src) => {
          const isActive = activeSource === src.id
          const isLoading = status[src.id] === 'loading'
          const count = results[src.id].length
          return (
            <button
              key={src.id}
              onClick={() => handleSourceChange(src.id)}
              className={`flex items-center gap-1 rounded-md border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-all ${
                isActive
                  ? 'border-[#2a2a2a] bg-[#141414]'
                  : 'border-transparent text-[#333] hover:bg-[#111] hover:text-[#666]'
              }`}
              style={isActive ? { color: src.color } : {}}
            >
              {isLoading ? (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: src.color }} />
              ) : count > 0 ? (
                <span
                  className="rounded-sm px-0.5 font-mono text-[9px]"
                  style={isActive ? { color: src.color } : { color: '#333' }}
                >
                  {count}
                </span>
              ) : null}
              {src.label}
            </button>
          )
        })}
      </div>

      {/* Results */}
      <div className="flex flex-col gap-2 overflow-y-auto p-3 [scrollbar-color:#222_transparent] [scrollbar-width:thin]">
        {/* PhilPapers: always show link card */}
        {activeSource === 'philpapers' && query.trim() && (
          <PhilCard query={query} />
        )}

        {/* Loading skeletons */}
        {currentStatus === 'loading' && (
          <>
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </>
        )}

        {/* Error */}
        {currentStatus === 'error' && (
          <div className="rounded-lg border border-[#2a1a1a] bg-[#1a0e0e] px-3 py-2 font-mono text-[11px] text-[#884]">
            ❌ {currentError}
          </div>
        )}

        {/* Results */}
        {currentStatus === 'done' && currentResults.length === 0 && (
          <div className="py-6 text-center font-mono text-[11px] text-[#333]">
            Sin resultados para "{truncate(query, 30)}"
          </div>
        )}

        {currentResults.map((r) => (
          <ResultCard key={r.id} result={r} />
        ))}

        {/* Idle state */}
        {currentStatus === 'idle' && activeSource !== 'philpapers' && (
          <div className="py-6 text-center font-mono text-[11px] text-[#2a2a2a]">
            Escribe para buscar
          </div>
        )}
      </div>
    </div>
  )
}
