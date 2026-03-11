import { useRef, useState, useEffect, KeyboardEvent, useCallback } from 'react'
import { useLectioStore } from '@/store'
import { useChat } from '@/hooks/useChat'
import { MessageRow } from './MessageRow'

const QUICK_CHIPS = [
  'Resume el documento en 3 puntos clave',
'¿Cuáles son los conceptos principales?',
'¿Qué argumenta el autor en esta página?',
'Genera 5 preguntas de comprensión',
'Explica los términos técnicos',
]

const CHIP_LABELS = ['Resumen', 'Esta página', 'Quiz', 'Glosario']

const MODEL_HINTS = { claude: 'sk-ant-', gemini: 'AIza' }

interface ChatPanelProps {
  onOpenPhilPapers?: () => void
  philOpen?: boolean
}

export function ChatPanel({ onOpenPhilPapers, philOpen }: ChatPanelProps) {
  const { chat, pdf, settings, setApiKey, setPendingSnap, setSettingsOpen } = useLectioStore()
  const { send, clearChat, setProvider } = useChat()

  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages])

  const handleSend = useCallback(() => {
    if (!input.trim() && !pdf.pendingSnap) return
      send(input.trim())
      setInput('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
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
  const dotOk = key.startsWith(hint) && key.length > 10
  const dotErr = key.length > 0 && !key.startsWith(hint)

  const providerName = provider === 'claude' ? 'Claude' : 'Gemini'
  const hasMessages = chat.messages.filter(
    (m) =>
    m.type !== 'system' ||
    m.content.startsWith('📄') ||
    m.content.startsWith('⚠') ||
    m.content.startsWith('❌')
  ).length > 0

  return (
    <div className="flex h-full flex-col" style={{ background: '#0a0a0a' }}>
    {/* Top bar */}
    <div className="flex h-[42px] flex-shrink-0 items-center justify-end gap-1 border-b border-[#1a1a1a] bg-[#0d0d0d] px-3">
    <div
    className={`mr-1 h-1.5 w-1.5 rounded-full transition-all ${
      dotOk
      ? 'bg-accent-green shadow-[0_0_6px_theme(colors.accent.green)]'
      : dotErr
      ? 'bg-accent-red'
      : 'bg-[#2a2a2a]'
    }`}
    />

    {/* PhilPapers search button */}
    {onOpenPhilPapers && (
      <button
      onClick={onOpenPhilPapers}
      title="Buscar en PhilPapers"
      className={`flex h-[27px] items-center gap-1.5 rounded-[7px] px-2 font-mono text-[9px] uppercase tracking-wider transition-all ${
        philOpen
        ? 'bg-[#161616] text-[#888] border border-[#2a2a2a]'
        : 'text-text-muted hover:bg-surface-raised hover:text-text-primary'
      }`}
      >
      {/* PhilPapers "phi" icon */}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M7 8 Q12 12 17 8" />
      <path d="M7 16 Q12 12 17 16" />
      </svg>
      <span>Phil</span>
      </button>
    )}

    <button
    onClick={clearChat}
    title="Limpiar chat"
    className="flex h-[27px] w-[27px] items-center justify-center rounded-[7px] text-text-muted transition-all hover:bg-surface-raised hover:text-text-primary"
    >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3,6 5,6 21,6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M9 6V4h6v2" />
    </svg>
    </button>
    <button
    onClick={() => setSettingsOpen(true)}
    title="Ajustes"
    className="flex h-[27px] w-[27px] items-center justify-center rounded-[7px] text-text-muted transition-all hover:bg-surface-raised hover:text-text-primary"
    >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
    </button>
    </div>

    {/* Messages */}
    <div className="flex-1 overflow-y-auto py-3 [scrollbar-width:thin] [scrollbar-color:#2a2a2a_transparent]">
    {!hasMessages ? (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-5 py-6 text-center">
      <div className="text-[26px] text-[#2a2a2a]">◈</div>
      <div className="text-[13px] font-medium text-text-muted">Asistente de lectura</div>
      </div>
    ) : (
      <div className="flex flex-col gap-0.5">
      {chat.messages.map((msg) => (
        <MessageRow key={msg.id} message={msg} providerName={providerName} />
      ))}
      </div>
    )}
    <div ref={messagesEndRef} />
    </div>

    {/* Context pill */}
    {pdf.pendingSnap && (
      <div className="px-3 pb-1">
      <div className="inline-flex items-center gap-1 rounded-full border border-surface-border2 bg-[#1a1a1a] px-2 py-0.5 font-mono text-[10px] text-[#888]">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
      <span>Captura p.{pdf.pendingSnap.pageN}</span>
      <button
      onClick={() => setPendingSnap(null)}
      className="ml-0.5 text-[#555] text-[13px] leading-none hover:text-white"
      >
      ×
      </button>
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
      className="whitespace-nowrap rounded-full border border-surface-border bg-surface-raised px-3 py-0.5 text-[11px] text-text-muted transition-all hover:border-[#444] hover:bg-[#1a1a1a] hover:text-text-primary disabled:opacity-30"
      >
      {label}
      </button>
    ))}
    </div>

    {/* Input area */}
    <div className="flex-shrink-0 border-t border-surface-border px-3 pb-3 pt-2">
    {/* Provider tabs + API key */}
    <div className="mb-2 flex items-center gap-1">
    {(['claude', 'gemini'] as const).map((p) => {
      const k = chat.apiKeys[p]
      const h = MODEL_HINTS[p]
      const ok = k.startsWith(h) && k.length > 10
      const err = k.length > 0 && !k.startsWith(h)
      return (
        <button
        key={p}
        onClick={() => setProvider(p)}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-all ${
          provider === p
          ? 'border-surface-border bg-[#161616] text-text-primary'
          : 'border-transparent bg-none text-[#333] hover:bg-[#111] hover:text-[#666]'
        }`}
        >
        <span
        className={`h-[5px] w-[5px] flex-shrink-0 rounded-full transition-all ${
          ok
          ? 'bg-accent-green shadow-[0_0_5px_theme(colors.accent.green)]'
          : err
          ? 'bg-accent-red'
          : 'bg-[#2a2a2a]'
        }`}
        />
        {p}
        </button>
      )
    })}
    <div className="flex-1" />
    <input
    type="password"
    placeholder={provider === 'claude' ? 'sk-ant-…' : 'AIza…'}
    value={chat.apiKeys[provider]}
    onChange={(e) => setApiKey(provider, e.target.value)}
    className="w-24 border-b border-[#1a1a1a] bg-transparent px-1 py-0.5 font-mono text-[10px] text-[#333] outline-none placeholder:text-[#252525] focus:border-[#3a3a3a] focus:text-[#888]"
    />
    </div>

    {/* Text input */}
    <div className="flex items-end gap-1.5 rounded-[9px] border border-surface-border bg-surface-raised px-2 py-2 focus-within:border-[#333]">
    <textarea
    ref={textareaRef}
    value={input}
    onChange={(e) => handleTextareaChange(e.target.value)}
    onKeyDown={handleKey}
    placeholder="Ask anything"
    rows={1}
    disabled={chat.busy}
    className="flex-1 resize-none bg-transparent font-sans text-[13px] leading-relaxed text-text-primary outline-none placeholder:text-[#2e2e2e] disabled:opacity-50"
    style={{ minHeight: '20px', maxHeight: '90px' }}
    />
    <div className="flex flex-shrink-0 items-center gap-1">
    <label
    htmlFor="file-input-chat"
    title="Abrir PDF"
    className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-md text-text-muted transition-all hover:bg-[#1a1a1a] hover:text-text-primary"
    >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    </svg>
    </label>
    <button
    onClick={handleSend}
    disabled={chat.busy || (!input.trim() && !pdf.pendingSnap)}
    className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-md bg-white text-black transition-all hover:bg-[#ddd] disabled:cursor-not-allowed disabled:opacity-30"
    >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22,2 15,22 11,13 2,9" />
    </svg>
    </button>
    </div>
    </div>
    </div>
    </div>
  )
}
