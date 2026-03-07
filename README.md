# l'reader

PDF reader with AI chat assistant. Built with React + TypeScript + Tailwind.

```bash
npm install
npm run dev
```

## Structure

```
src/
├── components/
│   ├── chat/
│   │   ├── ChatPanel.tsx       # Chat UI, provider tabs, quick chips
│   │   └── MessageRow.tsx      # Individual message renderer
│   ├── pdf/
│   │   └── PdfPanel.tsx        # PDF viewer, toolbar, snap tool
│   ├── settings/
│   │   └── SettingsModal.tsx   # Settings overlay
│   └── ui/
│       └── Resizer.tsx         # Draggable panel divider
├── hooks/
│   ├── useChat.ts              # Send message, history compression
│   └── usePdf.ts               # Load PDF, render pages, capture area
├── lib/
│   ├── ai/
│   │   ├── index.ts            # Claude + Gemini API calls, system prompt builder
│   │   └── format.ts           # Markdown → HTML formatter
│   └── pdf/
│       └── intelligence.ts     # TF-IDF, section detection, page retrieval
├── store/
│   └── index.ts                # Zustand global store (pdf + chat + settings)
├── types/
│   └── index.ts                # Shared TypeScript types
├── App.tsx                     # Root layout with resizable panels
├── main.tsx                    # Entry point
└── index.css                   # Tailwind base + global overrides
```
