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
  const {
    chat,
    pdf,
    settings,
    addMessage,
    clearChat,
    setBusy,
    setProvider,
    setApiKey,
    setHistorySummary,
    setPendingSnap,
  } = useLectioStore()

  const send = useCallback(
    async (userText: string) => {
      if (chat.busy) return
      if (!userText.trim() && !pdf.pendingSnap) return

      const m = chat.provider
      const key = chat.apiKeys[m]
      if (!key) {
        addMessage({
          id: uid(),
          type: 'system',
          content: `⚠ Introduce tu API Key de ${m === 'claude' ? 'Anthropic' : 'Google AI Studio'}.`,
          timestamp: Date.now(),
        })
        return
      }

      // Push user message
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

      // Push typing placeholder id
      const typingId = uid()
      addMessage({
        id: typingId,
        type: 'system',
        content: '__typing__',
        timestamp: Date.now(),
      })

      try {
        const system = buildSystemPrompt({
          pdfName: pdf.name,
          totalPages: pdf.totalPages,
          currentPage: pdf.currentPage,
          pageText: pdf.text,
          index: pdf.index,
          settings,
        })

        const messages = buildApiMessages({
          messages: chat.messages.filter((m) => m.type !== 'system' || (m as any).content === '__typing__' ? false : true),
          historySummary: chat.historySummary,
          userText,
          pendingSnap: pdf.pendingSnap,
          pageText: pdf.text,
          index: pdf.index,
          currentPage: pdf.currentPage,
          totalPages: pdf.totalPages,
          settings,
        })

        let reply: string
        if (m === 'claude') {
          reply = await callClaude(key, system, messages)
        } else {
          reply = await callGemini(key, system, messages, settings.geminiModel)
        }

        // Remove typing placeholder — store will handle it via addMessage replacing
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
        const textMsgs = chat.messages.filter((m) => m.type === 'text')
        if (textMsgs.length > 10 && !chat.historySummary) {
          const mid = textMsgs.slice(2, -6)
          const midText = mid
            .map((m) => `${m.role === 'user' ? 'Usuario' : 'IA'}: ${(m as any).content.slice(0, 120)}`)
            .join('\n')
          setHistorySummary(`[Resumen de ${mid.length} mensajes anteriores: ${midText.slice(0, 400)}]`)
        }

        setPendingSnap(null)
      } catch (err: any) {
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
    [chat, pdf, settings, addMessage, setBusy, setHistorySummary, setPendingSnap]
  )

  return {
    send,
    clearChat,
    setProvider,
    setApiKey,
  }
}
