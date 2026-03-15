import { invoke } from '@tauri-apps/api/core'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useLectioStore } from '@/store'

interface SearchResult {
  id: string
  source: 'arxiv' | 'scholar' | 'philpapers'
  title: string
  authors: string[]
  year: string
  abstract: string
  pdfUrl?: string
  link: string
}

type Source = 'arxiv' | 'scholar' | 'philpapers'

const SOURCE_COLORS: Record<Source, string> = {
  arxiv: '#e8824a',
  scholar: '#5fba75',
  philpapers: '#5fa8e8',
}
const SOURCE_LABELS: Record<Source, string> = {
  arxiv: 'arXiv',
  scholar: 'Scholar',
  philpapers: 'PhilPapers',
}

async function searchArxiv(q: string, limit = 12): Promise<SearchResult[]> {
  const results = await invoke<SearchResult[]>('search_arxiv', { q, limit })
  return results.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0))
}

async function searchScholar(q: string, limit = 12): Promise<SearchResult[]> {
  const results = await invoke<SearchResult[]>('search_scholar', { q, limit })
  return results.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0))
}

function philPapersUrl(q: string) {
  return `https://philpapers.org/s/${encodeURIComponent(q)}`
}

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({ result, onImport }: { result: SearchResult; onImport: (url: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [importing, setImporting] = useState(false)
  const color = SOURCE_COLORS[result.source]

  const handleImport = async () => {
    if (!result.pdfUrl) return
    setImporting(true)
    try {
      const b64 = await invoke<string>('fetch_pdf', { url: result.pdfUrl })
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const file  = new File([bytes], result.title.slice(0, 60) + '.pdf', { type: 'application/pdf' })
      window.dispatchEvent(new CustomEvent('lectio:load-pdf', { detail: { file } }))
      onImport(result.title)
    } catch {
      window.open(result.link, '_blank')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-[#1f1f1f] bg-[#111] p-2.5 transition-colors hover:border-[#252525]">
      <div className="flex items-start gap-1.5">
        <span
          className="mt-0.5 flex h-[16px] flex-shrink-0 items-center rounded-full px-1.5 text-[8.5px] font-bold uppercase tracking-[.06em]"
          style={{ background: color + '1f', color }}
        >
          {SOURCE_LABELS[result.source]}
        </span>
        <span className="flex-1 text-[11.5px] font-medium leading-snug text-[#f0f0f0]">
          {result.title}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-[#3a3a3a]">
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {result.authors.slice(0, 3).join(', ')}
        </span>
        {result.year && <span className="flex-shrink-0 text-[#2e2e2e]">{result.year}</span>}
      </div>

      {expanded && result.abstract && (
        <p className="text-[11px] leading-relaxed text-[#363636]">{result.abstract}</p>
      )}

      <div className="flex items-center gap-1">
        {result.abstract && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex h-[22px] items-center gap-1 rounded-full border border-[#1e1e1e] px-2 text-[10px] text-[#444] transition-all hover:border-[#2a2a2a] hover:bg-[#131313] hover:text-[#888]"
          >
            {expanded ? 'Menos' : 'Resumen'}
          </button>
        )}
        <a
          href={result.link}
          target="_blank"
          rel="noreferrer"
          className="flex h-[22px] items-center gap-1 rounded-full border border-[#1e1e1e] px-2 text-[10px] text-[#444] transition-all hover:border-[#2a2a2a] hover:bg-[#131313] hover:text-[#888]"
        >
          Ver
        </a>
        {result.pdfUrl && (
          <button
            onClick={handleImport}
            disabled={importing}
            className="ml-auto flex h-[22px] items-center gap-1 rounded-full border border-[rgba(95,186,117,.18)] bg-[rgba(95,186,117,.07)] px-2 text-[10px] text-[#5fba75] transition-all hover:border-[rgba(95,186,117,.3)] hover:bg-[rgba(95,186,117,.13)] disabled:opacity-50"
          >
            {importing ? (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                <circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10"/>
              </svg>
            ) : (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            )}
            Abrir PDF
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface SearchPanelProps {
  /** When true: rendered inside a tab, no close button, no absolute positioning */
  embedded?: boolean
  onClose?: () => void
  onImported?: (title: string) => void
}

export function SearchPanel({ embedded = false, onClose, onImported }: SearchPanelProps) {
  const [source, setSource] = useState<Source>('arxiv')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string, src: Source) => {
    if (!q.trim()) return
    setState('loading')
    setResults([])
    try {
      let res: SearchResult[]
      if (src === 'arxiv') res = await searchArxiv(q)
      else if (src === 'scholar') res = await searchScholar(q)
      else {
        window.open(philPapersUrl(q), '_blank')
        setState('idle')
        return
      }
      setResults(res)
      setState('done')
    } catch {
      setState('error')
    }
  }, [])

  const handleInput = (v: string) => {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v, source), 500)
  }

  const handleSourceChange = (s: Source) => {
    setSource(s)
    if (query.trim()) doSearch(query, s)
  }

  const content = (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      {/* Source tabs */}
      <div className="flex flex-shrink-0 items-center gap-0.5 border-b border-[#1a1a1a] bg-[#0d0d0d] px-2 py-1.5">
        {(['arxiv', 'philpapers', 'scholar'] as Source[]).map(s => (
          <button
            key={s}
            onClick={() => handleSourceChange(s)}
            className={`flex h-[26px] items-center gap-1.5 rounded-[7px] border px-2 text-[11px] font-medium transition-all ${
              source === s
                ? 'border-[#1a1a1a] bg-[#111]'
                : 'border-transparent text-[#2e2e2e] hover:bg-[#111] hover:text-[#666]'
            }`}
            style={source === s ? { color: SOURCE_COLORS[s] } : {}}
          >
            <span
              className="h-[5px] w-[5px] flex-shrink-0 rounded-full opacity-50"
              style={{ background: SOURCE_COLORS[s] }}
            />
            {SOURCE_LABELS[s]}
          </button>
        ))}
        {!embedded && onClose && (
          <button
            onClick={onClose}
            className="ml-auto flex h-[26px] w-[26px] items-center justify-center rounded-[7px] text-[#444] transition-all hover:bg-[#1a1a1a] hover:text-[#f0f0f0]"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Search input */}
      <div className="flex-shrink-0 px-2 py-2">
        <div className="flex h-[32px] items-center gap-1.5 rounded-[9px] border border-[#1f1f1f] bg-[#111] px-2.5 focus-within:border-[#2e2e2e]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-[#2a2a2a]">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            autoFocus={!embedded}
            value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch(query, source)}
            placeholder="Buscar papers…"
            className="flex-1 bg-transparent text-[12.5px] text-[#f0f0f0] outline-none placeholder:text-[#252525]"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setState('idle') }}
              className="flex-shrink-0 text-[#333] hover:text-[#888]"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
          <button
            onClick={() => doSearch(query, source)}
            className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[6px] bg-[#1a1a1a] text-[#555] transition-all hover:bg-[#242424] hover:text-[#bbb]"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Results */}
      <div
        className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a1a transparent' }}
      >
        {state === 'idle' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-[#1e1e1e]">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p className="text-[12px] font-medium text-[#2a2a2a]">Busca papers</p>
            <p className="text-[10px] leading-relaxed text-[#1c1c1c]">Busca en arXiv, PhilPapers<br />y Google Scholar.</p>
          </div>
        )}
        {state === 'loading' && (
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-[#1e1e1e] border-t-[#3a3a3a]" />
          </div>
        )}
        {state === 'error' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-[12px] text-[#555]">Error en la búsqueda</p>
            <button onClick={() => doSearch(query, source)} className="text-[11px] text-[#444] hover:text-[#888] underline">
              Reintentar
            </button>
          </div>
        )}
        {state === 'done' && results.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-[12px] font-medium text-[#2e2e2e]">Sin resultados</p>
            <p className="text-[10px] text-[#1c1c1c]">Prueba con otros términos</p>
          </div>
        )}
        {results.map(r => (
          <ResultCard key={r.id} result={r} onImport={title => onImported?.(title)} />
        ))}
        {state === 'done' && results.length > 0 && source === 'scholar' && (
          <p className="px-1 text-center text-[10px] leading-relaxed text-[#252525]">
            Scholar no siempre ofrece PDFs. Si no está disponible, se abrirá en el navegador.
          </p>
        )}
      </div>
    </div>
  )

  // Embedded: just return the content
  if (embedded) return content

  // Floating mode (used when triggered from PDF panel)
  return (
    <div
      style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 360,
        zIndex: 20, display: 'flex', flexDirection: 'column',
        background: '#0a0a0a', borderLeft: '1px solid #1e1e1e',
        overflow: 'hidden',
      }}
    >
      {content}
    </div>
  )
}
