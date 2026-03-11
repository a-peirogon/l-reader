import { useCallback } from 'react'
import { useLectioStore } from '@/store'
import {
  buildSystemPrompt,
  buildApiMessages,
  callClaude,
  callGemini,
} from '@/lib/ai'
import type { ChatMessage } from '@/types'

function uid() {
  return Math.random().toString(36).slice(2)
}

export function useChat() {
  // Only pull stable action references — NOT chat/pdf/settings objects.
  // Reading those in the closure causes stale-state bugs (double-send, stale
  // messages in API call, etc.).  All dynamic state is read via getState()
  // at call time inside `send`.
  const { clearChat, setBusy, setProvider, setApiKey, addMessage, setHistorySummary, setPendingSnap } =
  useLectioStore()

  const send = useCallback(
    async (userText: string) => {
      // ── Read current state at call-time, never from the closure ──────────
      const { chat, pdf, settings } = useLectioStore.getState()

      if (chat.busy) return
        if (!userText.trim() && !pdf.pendingSnap) return

          const provider = chat.provider
          const key = chat.apiKeys[provider]
          if (!key) {
            addMessage({
              id: uid(),
                       type: 'system',
                       content: `⚠ Introduce tu API Key de ${provider === 'claude' ? 'Anthropic' : 'Google AI Studio'}.`,
                       timestamp: Date.now(),
            })
            return
          }

          // ── Push user messages into the store ─────────────────────────────────
          if (userText.trim()) {
            addMessage({
              id: uid(),
                       role: 'user',
                       type: 'text',
                       content: userText,
                       timestamp: Date.now(),
            } as ChatMessage)
          }

          if (pdf.pendingSnap) {
            addMessage({
              id: uid(),
                       role: 'user',
                       type: 'snap',
                       dataUrl: pdf.pendingSnap.dataUrl,
                       pageN: pdf.pendingSnap.pageN,
                       label: `Fragmento — p. ${pdf.pendingSnap.pageN}`,
                       timestamp: Date.now(),
            } as ChatMessage)
          }

          setBusy(true)

          const typingId = uid()
          addMessage({
            id: typingId,
            type: 'system',
            content: '__typing__',
            timestamp: Date.now(),
          })

          try {
            // ── Re-read messages AFTER the addMessage calls above ────────────────
            // (getState() always returns the latest snapshot)
            const currentMessages = useLectioStore.getState().chat.messages

            const system = buildSystemPrompt({
              pdfName: pdf.name,
              totalPages: pdf.totalPages,
              currentPage: pdf.currentPage,
              pageText: pdf.text,
              index: pdf.index,
              settings,
            })

            const messages = buildApiMessages({
              // Filter out ALL system messages (including typing placeholder)
              messages: currentMessages.filter((m) => m.type !== 'system'),
                                              historySummary: useLectioStore.getState().chat.historySummary,
                                              userText,
                                              pendingSnap: pdf.pendingSnap,
                                              pageText: pdf.text,
                                              index: pdf.index,
                                              currentPage: pdf.currentPage,
                                              totalPages: pdf.totalPages,
                                              settings,
            })

            let reply: string
            if (provider === 'claude') {
              reply = await callClaude(key, system, messages)
            } else {
              reply = await callGemini(key, system, messages, settings.geminiModel)
            }

            // Remove typing placeholder
            addMessage({
              id: typingId,
              type: 'system',
              content: '__remove__',
              timestamp: Date.now(),
            })

            addMessage({
              id: uid(),
                       role: 'assistant',
                       type: 'text',
                       content: reply,
                       timestamp: Date.now(),
            } as ChatMessage)

            // Compress old history if needed
            const textMsgs = useLectioStore.getState().chat.messages.filter((m) => m.type === 'text')
            if (textMsgs.length > 10 && !useLectioStore.getState().chat.historySummary) {
              const mid = textMsgs.slice(2, -6)
              const midText = mid
              .map((m) => `${m.role === 'user' ? 'Usuario' : 'IA'}: ${(m as any).content.slice(0, 120)}`)
              .join('\n')
              setHistorySummary(`[Resumen de ${mid.length} mensajes anteriores: ${midText.slice(0, 400)}]`)
            }

            setPendingSnap(null)
          } catch (err: any) {
            // Remove typing placeholder even on error
            addMessage({
              id: typingId,
              type: 'system',
              content: '__remove__',
              timestamp: Date.now(),
            })
            addMessage({
              id: uid(),
                       type: 'system',
                       content: `❌ ${err.message}`,
                       timestamp: Date.now(),
            })
          } finally {
            setBusy(false)
          }
    },
    // Only stable actions in deps — no chat/pdf/settings objects
    [addMessage, setBusy, setHistorySummary, setPendingSnap]
  )

  return {
    send,
    clearChat,
    setProvider,
    setApiKey,
  }
}
