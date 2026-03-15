# Lectio — Desktop (Tauri)

Lector académico de PDFs con IA. App de escritorio construida con Tauri 2 + React + Rust.

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 18 + Zustand + Tailwind |
| Bundler | Vite 5 |
| Shell nativo | Tauri 2 |
| Backend | Rust (tokio + reqwest) |
| IA | Gemini / Claude (llamadas directas desde Rust, sin CORS) |

## Prerrequisitos

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node 20+
node --version

# Tauri CLI (se instala con npm)
npm install   # instala @tauri-apps/cli entre otros

# Dependencias del sistema (Linux)
# Ubuntu/Debian:
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# macOS: solo necesitas Xcode Command Line Tools
xcode-select --install
```

## Desarrollo

```bash
npm run dev        # Arranca Tauri + Vite en modo dev con hot reload
```

La primera compilación de Rust tarda ~2 minutos. Las siguientes son incrementales.

## Build

```bash
npm run build      # Genera instalador en src-tauri/target/release/bundle/
```

Produce:
- `.dmg` en macOS
- `.msi` / `.exe` en Windows  
- `.deb` / `.AppImage` en Linux

## Comandos Tauri disponibles

Todos los comandos se invocan desde el frontend con `invoke('nombre_comando', { ...args })`.

| Comando | Descripción |
|---|---|
| `search_arxiv` | Busca papers en arXiv (XML nativo, sin proxy) |
| `search_scholar` | Scraping de Google Scholar |
| `fetch_pdf` | Descarga PDF remoto → base64 |
| `open_pdf_dialog` | Abre selector de archivo nativo → PDF como base64 |
| `call_claude` | Llamada a Claude API |
| `call_gemini` | Llamada a Gemini API |
| `build_doc_summary` | Genera resumen estructurado del documento |

## Diferencias respecto a la versión web

- Las llamadas a la IA se hacen desde Rust: no se necesita `anthropic-dangerous-direct-browser-access`
- El selector de archivos es nativo del SO (sin `<input type="file">`)
- Sin servidor backend separado (no hay Hono/Bun)
- Sin proxy `/api/*` — todo va directo desde Rust

## Variables de entorno

No hay variables de entorno requeridas. Las API keys se guardan en el store de Zustand (localStorage del webview).

Para producción puedes moverlas a `tauri-plugin-store` para persistencia segura entre sesiones.
