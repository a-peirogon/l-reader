import { useRef, useState } from 'react'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { PdfPanel } from '@/components/pdf/PdfPanel'
import { Resizer } from '@/components/ui/Resizer'
import { SettingsModal } from '@/components/settings/SettingsModal'

export default function App() {
  const [chatWidth, setChatWidth] = useState(320)
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex h-screen w-full items-stretch bg-black p-[10px]">
      <div
        ref={containerRef}
        className="flex flex-1 overflow-hidden rounded-[16px] border border-[#1a1a1a]"
      >
        {/* Chat panel */}
        <div
          style={{ width: chatWidth, minWidth: 220, maxWidth: 480, flexShrink: 0 }}
          className="rounded-l-[16px] overflow-hidden"
        >
          <ChatPanel />
        </div>

        {/* Resizer */}
        <Resizer onResize={setChatWidth} containerRef={containerRef} />

        {/* PDF panel */}
        <div className="pdf-panel flex-1 min-w-0 overflow-hidden rounded-r-[16px]">
          <PdfPanel />
        </div>
      </div>

      {/* Settings modal */}
      <SettingsModal />
    </div>
  )
}
