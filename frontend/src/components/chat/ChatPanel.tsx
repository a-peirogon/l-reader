import { useRef, useState, useEffect, KeyboardEvent, useCallback } from 'react'
import { useLectioStore } from '@/store'
import { useChat } from '@/hooks/useChat'
import { useAnnotations } from '@/hooks/useAnnotations'
import { MessageRow } from './MessageRow'
import { AnnotationsView } from './AnnotationsView'
import { SearchPanel } from '@/components/search/SearchPanel'

const QUICK_CHIPS = [
  'Resume el documento en 3 puntos clave',
'¿Cuáles son los conceptos principales?',
'¿Qué argumenta el autor en esta página?',
'Genera 5 preguntas de comprensión',
]

const CHIP_LABELS = ['Resumen', 'Conceptos', 'Esta página', 'Quiz']

const MODEL_HINTS = { claude: 'sk-ant-', gemini: 'AIza' }

type Tab = 'asistente' | 'notas' | 'explorador'

// ── Logos ─────────────────────────────────────────────────────────────────────

function ClaudeLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" opacity=".9"/>
    </svg>
  )
}
function GeminiLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6z" opacity=".9"/>
    </svg>
  )
}

export function ChatPanel() {
  const { chat, pdf, settings, setApiKey, setPendingSnap, setSettingsOpen } = useLectioStore()
  const { send, clearChat, setProvider } = useChat()
  const ann = useAnnotations()

  const [input, setInput] = useState('')
  const [tab, setTab] = useState<Tab>('asistente')
  const [modelDropOpen, setModelDropOpen] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Auto-scroll messages
  useEffect(() => {
    if (tab === 'asistente') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages, tab])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setModelDropOpen(false)
      }
    }
    if (modelDropOpen) document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
  }, [modelDropOpen])

  // Inject selected PDF text into chat input from AnnotationLayer
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail.text as string
      if (!text) return
        setTab('asistente')
        setInput(prev => {
          const next = prev ? `${prev}\n\n"${text}"` : `"${text}"`
          // Resize textarea after state update
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto'
              textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 90) + 'px'
          textareaRef.current.focus()
            }
          })
          return next
        })
    }
    window.addEventListener('lectio:inject-text', handler)
    return () => window.removeEventListener('lectio:inject-text', handler)
  }, [])

  const handleSend = useCallback(() => {
    if (!input.trim() && !pdf.pendingSnap) return
      send(input.trim())
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [input, pdf.pendingSnap, send])

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (v: string) => {
    setInput(v)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 90) + 'px'
    }
  }

  const provider = chat.provider
  const key = chat.apiKeys[provider]
  const hint = MODEL_HINTS[provider]
  const dotOk  = key.startsWith(hint) && key.length > 10
  const dotErr = key.length > 0 && !dotOk

  const hasMessages = chat.messages.filter(m =>
  m.type !== 'system' ||
  (m as any).content?.startsWith('📄') ||
  (m as any).content?.startsWith('⚠') ||
  (m as any).content?.startsWith('❌')
  ).length > 0

  const annotCount = ann.allAnnotations.length

  // When new annotation is added and we're not on notas tab, flash badge
  const providerName = provider === 'claude' ? 'Claude' : 'Gemini'

  return (
    <div className="flex h-full flex-col" style={{ background: '#0a0a0a' }}>

    {/* ── Panel tabs ── */}
    <div className="flex h-[36px] flex-shrink-0 items-center gap-0.5 border-b border-[#1a1a1a] bg-[#0d0d0d] px-2.5">
    {([
      { id: 'asistente', label: 'Asistente', icon: (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        </svg>
      )},
      { id: 'notas', label: 'Notas', icon: (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
        </svg>
      ), badge: annotCount },
      { id: 'explorador', label: 'Explorador', icon: (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      )},
    ] as { id: Tab; label: string; icon: React.ReactNode; badge?: number }[]).map(t => (
      <button
      key={t.id}
      onClick={() => setTab(t.id)}
      className={`flex h-[26px] items-center gap-1.5 rounded-[7px] border px-2.5 text-[11.5px] font-medium transition-all ${
        tab === t.id
        ? 'border-[#1a1a1a] bg-[#111] text-[#f0f0f0]'
        : 'border-transparent text-[#3a3a3a] hover:bg-[#111] hover:text-[#666]'
      }`}
      >
      {t.icon}
      {t.label}
      {t.badge != null && t.badge > 0 && (
        <span className={`flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] transition-all ${
          tab === t.id ? 'bg-[#252525] text-[#888]' : 'bg-[#1e1e1e] text-[#555]'
        }`}>
        {t.badge}
        </span>
      )}
      </button>
    ))}
    </div>

    {/* ── ASISTENTE ── */}
    {tab === 'asistente' && (
      <>
      {/* Topbar with model selector */}
      <div className="relative flex h-[42px] flex-shrink-0 items-center justify-between border-b border-[#1a1a1a] bg-[#0d0d0d] px-2.5">

      {/* Model selector button */}
      <div ref={dropRef} className="relative">
      <button
      onClick={() => setModelDropOpen(v => !v)}
      className="flex items-center gap-1.5 rounded-[8px] border border-transparent px-2 py-1 text-[12px] font-medium text-[#f0f0f0] transition-all hover:border-[#1f1f1f] hover:bg-[#111]"
      >
      <span className="flex h-[16px] w-[16px] items-center justify-center rounded-[4px] text-[#f0f0f0]">
      {provider === 'claude' ? <ClaudeLogo /> : <GeminiLogo />}
      </span>
      {providerName}
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#444]">
      <polyline points="6,9 12,15 18,9"/>
      </svg>
      </button>

      {/* Dropdown */}
      {modelDropOpen && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-[190px] rounded-[10px] border border-[#222] bg-[#0e0e0e] p-1.5 shadow-[0_10px_40px_rgba(0,0,0,.7)]">
        {(['claude', 'gemini'] as const).map(p => {
          const k = chat.apiKeys[p]
          const h = MODEL_HINTS[p]
          const ok = k.startsWith(h) && k.length > 10
          const err = k.length > 0 && !ok
          return (
            <div key={p}>
            <div
            onClick={() => { setProvider(p); setModelDropOpen(false) }}
            className={`flex cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12px] transition-all hover:bg-[#1a1a1a] ${
              provider === p ? 'text-[#f0f0f0]' : 'text-[#bbb]'
            }`}
            >
            <span
            className={`h-[5px] w-[5px] flex-shrink-0 rounded-full transition-all ${
              ok ? 'bg-accent-green shadow-[0_0_5px_theme(colors.accent.green)]'
              : err ? 'bg-accent-red'
              : 'bg-[#2a2a2a]'
            }`}
            />
            {p === 'claude' ? 'Claude' : 'Gemini'}
            </div>
            <input
            type="password"
            value={chat.apiKeys[p]}
            onChange={e => setApiKey(p, e.target.value)}
            placeholder={p === 'claude' ? 'sk-ant-…' : 'AIza…'}
            className="mb-1 w-full border-b border-[#1a1a1a] bg-transparent px-2.5 py-1 text-[10px] text-[#444] outline-none placeholder:text-[#252525] focus:border-[#3a3a3a] focus:text-[#888]"
            />
            {p === 'claude' && <div className="my-1 h-px bg-[#1a1a1a]" />}
            </div>
          )
        })}
        </div>
      )}
      </div>

      {/* API status dot */}
      <div
      className={`h-[6px] w-[6px] rounded-full transition-all ${
        dotOk ? 'bg-accent-green shadow-[0_0_6px_theme(colors.accent.green)]'
        : dotErr ? 'bg-accent-red'
        : 'bg-[#2a2a2a]'
      }`}
      />

      {/* Right actions */}
      <div className="flex items-center gap-0.5">
      <button
      onClick={clearChat}
      title="Nuevo chat"
      className="flex h-[27px] items-center gap-1 rounded-[7px] px-2 text-[11px] text-[#555] transition-all hover:bg-[#111] hover:text-[#f0f0f0]"
      >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      Nuevo
      </button>
      <button
      onClick={() => setSettingsOpen(true)}
      title="Ajustes"
      className="flex h-[27px] w-[27px] items-center justify-center rounded-[7px] text-[#555] transition-all hover:bg-[#111] hover:text-[#f0f0f0]"
      >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      </svg>
      </button>
      </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 [scrollbar-width:thin] [scrollbar-color:#2a2a2a_transparent]">
      {!hasMessages ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-5 py-6 text-center">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-green opacity-70">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        <path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/>
        </svg>

        {/* Quick action cards */}
        <div className="flex w-full gap-1.5">
        {[
          { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>, title: 'Seleccionar y preguntar', desc: 'Captura cualquier fragmento del PDF' },
          { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>, title: 'Añadir contexto', desc: 'Pregunta sobre la página actual' },
        ].map(c => (
          <div key={c.title} className="flex flex-1 flex-col gap-1 rounded-[10px] border border-[#1f1f1f] bg-[#111] p-2.5">
          <span className="text-accent-green opacity-80">{c.icon}</span>
          <span className="text-[11px] font-semibold text-[#f0f0f0]">{c.title}</span>
          <span className="text-[10px] leading-relaxed text-[#444]">{c.desc}</span>
          </div>
        ))}
        </div>

        <p className="text-[10px] text-[#2a2a2a]">
        Pulsa <strong className="text-[#3a3a3a]">S</strong> para capturar un área
        </p>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
        {chat.messages.map(msg => (
          <MessageRow key={msg.id} message={msg} providerName={providerName} />
        ))}
        </div>
      )}
      <div ref={messagesEndRef} />
      </div>

      {/* Context pill */}
      {pdf.pendingSnap && (
        <div className="px-3 pb-1">
        <div className="inline-flex items-center gap-1 rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-0.5 text-[10px] text-[#888]">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        </svg>
        Captura p.{pdf.pendingSnap.pageN}
        <button onClick={() => setPendingSnap(null)} className="ml-0.5 text-[#555] hover:text-white">×</button>
        </div>
        </div>
      )}

      {/* Quick chips */}
      <div className="relative flex flex-wrap gap-1 px-3 pb-2 pt-1.5">
      <div className="pointer-events-none absolute -top-7 left-0 right-0 h-7 bg-gradient-to-b from-transparent to-[#0a0a0a]" />
      {CHIP_LABELS.map((label, i) => (
        <button
        key={label}
        onClick={() => send(QUICK_CHIPS[i])}
        disabled={chat.busy}
        className="whitespace-nowrap rounded-full border border-[#1f1f1f] bg-[#111] px-2.5 py-0.5 text-[10.5px] text-[#555] transition-all hover:border-[#333] hover:bg-[#1a1a1a] hover:text-[#f0f0f0] disabled:opacity-30"
        >
        {label}
        </button>
      ))}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-2 pb-2">
      <div className="flex min-h-[96px] flex-col gap-2 rounded-[12px] border border-[#1f1f1f] bg-[#111] p-2.5 focus-within:border-[#2e2e2e]">
      <textarea
      ref={textareaRef}
      value={input}
      onChange={e => handleTextareaChange(e.target.value)}
      onKeyDown={handleKey}
      placeholder="Ask anything about this PDF…"
      rows={1}
      disabled={chat.busy}
      className="flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-[#f0f0f0] outline-none placeholder:text-[#2a2a2a] disabled:opacity-50"
      style={{ minHeight: '20px', maxHeight: '90px' }}
      />
      <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
      <label
      htmlFor="file-input-chat"
      className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full border border-[#1f1f1f] text-[#555] transition-all hover:bg-[#1a1a1a] hover:text-[#f0f0f0]"
      title="Adjuntar PDF"
      >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13.234 20.252 21 12.3"/><path d="m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486"/>
      </svg>
      </label>
      <button
      onClick={() => useLectioStore.getState().setSnapActive(!useLectioStore.getState().pdf.snapActive)}
      className={`flex h-[26px] items-center gap-1.5 rounded-full border px-2 text-[11px] transition-all ${
        pdf.snapActive
        ? 'border-accent-green bg-[rgba(95,186,117,.08)] text-accent-green'
        : 'border-[#1f1f1f] text-[#555] hover:bg-[#1a1a1a] hover:text-[#f0f0f0] hover:border-[#333]'
      }`}
      title="Capturar área (S)"
      >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>
      </svg>
      Captura
      </button>
      </div>
      <button
      onClick={handleSend}
      disabled={chat.busy || (!input.trim() && !pdf.pendingSnap)}
      className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:bg-[#ccc] disabled:cursor-not-allowed disabled:opacity-20"
      >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>
      </svg>
      </button>
      </div>
      </div>
      </div>
      </>
    )}

    {/* ── NOTAS ── */}
    {tab === 'notas' && <AnnotationsView />}

    {/* ── EXPLORADOR ── */}
    {tab === 'explorador' && (
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
      <SearchPanel embedded onImported={() => {}} />
      </div>
    )}
    </div>
  )
}
