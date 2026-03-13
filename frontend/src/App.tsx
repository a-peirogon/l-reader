import { useRef, useState } from 'react'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { PdfPanel } from '@/components/pdf/PdfPanel'
import { Resizer } from '@/components/ui/Resizer'
import { SettingsModal } from '@/components/settings/SettingsModal'

export default function App() {
  const [chatWidth, setChatWidth] = useState(320)
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex h-screen w-full bg-black p-[8px]">
    <div
    ref={containerRef}
    className="flex flex-1 min-w-0 gap-[6px]"
    >
    {/* Chat panel */}
    <div
    style={{ width: chatWidth, minWidth: 220, maxWidth: 480, flexShrink: 0 }}
    className="h-full overflow-hidden rounded-[16px] border border-[#181818] bg-[#0a0a0a]"
    >
    <ChatPanel />
    </div>

    {/* Resizer */}
    <Resizer onResize={setChatWidth} containerRef={containerRef} />

    {/* PDF panel */}
    <div className="h-full flex-1 min-w-0 overflow-hidden rounded-[16px] border border-[#181818] bg-black">
    <PdfPanel />
    </div>
    </div>

    <SettingsModal />
    </div>
  )
}
