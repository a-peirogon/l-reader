# Lectio

PDF reader with AI chat assistant. Built with React + TypeScript + Tailwind.

## Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **State**: Zustand
- **PDF**: pdfjs-dist (client-side, no server needed)
- **AI**: Claude (Anthropic) + Gemini (Google AI Studio) — direct browser calls
- **Deploy**: Vercel (static SPA, zero backend)

## Getting Started

```bash
npm install
npm run dev
```

## Project Structure

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

## API Keys

Keys are entered directly in the chat panel (never leave the browser). No backend required.

- **Claude**: get yours at [console.anthropic.com](https://console.anthropic.com)
- **Gemini**: get yours at [aistudio.google.com](https://aistudio.google.com)

## Deploy to Vercel

```bash
npm run build
# push to GitHub, import in Vercel — done
```

No environment variables needed. All API calls go browser → AI provider directly.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` | Toggle snap/capture tool |
| `Esc` | Cancel snap |
| `← / ↑` | Previous page |
| `→ / ↓` | Next page |
| `Ctrl+Enter` | Send message |
