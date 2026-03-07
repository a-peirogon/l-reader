import { formatMarkdown } from '@/lib/ai/format'
import type { ChatMessage } from '@/types'

// ─── Typing indicator ─────────────────────────────────────────────────────────

export function TypingBubble({ provider }: { provider: string }) {
  return (
    <div className="animate-fadeUp px-3 py-1">
      <div className="mb-1 flex items-center gap-1">
        <span className="h-1 w-1 rounded-full bg-text-secondary" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
          {provider}
        </span>
      </div>
      <div className="rounded-lg border border-transparent bg-[#0d0d0d] px-3 py-2">
        <div className="flex items-center gap-1 py-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-[5px] w-[5px] rounded-full bg-[#444] animate-bounce3"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Message row ──────────────────────────────────────────────────────────────

interface MessageRowProps {
  message: ChatMessage
  providerName: string
}

export function MessageRow({ message, providerName }: MessageRowProps) {
  if (message.type === 'system') {
    if (message.content === '__typing__') {
      return <TypingBubble provider={providerName} />
    }
    if (message.content === '__remove__') return null
    return (
      <div className="mx-3 my-0.5 border-l-2 border-surface-border px-3 font-mono text-[11px] text-text-dim">
        {message.content}
      </div>
    )
  }

  const isUser = message.role === 'user'

  if (message.type === 'snap') {
    return (
      <div className="animate-fadeUp px-3 py-1">
        <div className="mb-1 flex items-center gap-1">
          <span className={`h-1 w-1 rounded-full ${isUser ? 'bg-text-muted' : 'bg-text-secondary'}`} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">tú</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-raised">
          <div className="flex items-center gap-1.5 border-b border-surface-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#666]">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            {message.label}
          </div>
          <img src={message.dataUrl} alt={message.label} className="block w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadeUp px-3 py-1">
      <div className="mb-1 flex items-center gap-1">
        <span className={`h-1 w-1 rounded-full ${isUser ? 'bg-text-muted' : 'bg-text-secondary'}`} />
        <span
          className={`font-mono text-[10px] uppercase tracking-widest ${
            isUser ? 'text-text-muted' : 'text-[#888]'
          }`}
        >
          {isUser ? 'tú' : providerName.toLowerCase()}
        </span>
      </div>
      {isUser ? (
        <div className="rounded-lg border border-surface-border bg-[#141414] px-3 py-2 text-[12.5px] leading-relaxed text-text-primary">
          {message.content}
        </div>
      ) : (
        <div
          className="msg-ai rounded-lg bg-[#0d0d0d] px-3 py-2 text-[12.5px] leading-relaxed text-[#bbb]"
          dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
        />
      )}
    </div>
  )
}
