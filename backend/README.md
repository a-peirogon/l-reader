# Lectio — Backend

Servidor Hono + Bun que actúa de proxy para arXiv, Semantic Scholar y los modelos de IA (Claude / Gemini), eliminando las restricciones de CORS del navegador.

## Requisitos

- [Bun](https://bun.sh) ≥ 1.0

## Desarrollo local

```bash
cd backend
cp .env.example .env      # edita las variables que quieras
bun install
bun run dev               # arranca en http://localhost:3001
```

En paralelo, el frontend (Vite) ya tiene un proxy configurado en `vite.config.ts`:
cualquier petición a `/api/*` se reescribe a `http://localhost:3001/*` automáticamente.

```bash
cd frontend
bun run dev               # arranca en http://localhost:5173
```

## Variables de entorno

| Variable           | Descripción                                      | Requerida |
|--------------------|--------------------------------------------------|-----------|
| `PORT`             | Puerto del servidor (defecto: 3001)              | No        |
| `FRONTEND_URL`     | URL del frontend en prod (para CORS)             | En prod   |
| `ANTHROPIC_API_KEY`| API key de Claude (si se gestiona server-side)   | No        |
| `GOOGLE_AI_KEY`    | API key de Gemini (si se gestiona server-side)   | No        |

Si `ANTHROPIC_API_KEY` / `GOOGLE_AI_KEY` no están definidas, el backend acepta las keys enviadas por el cliente en los headers `x-claude-key` / `x-gemini-key` (comportamiento actual del frontend).

## Endpoints

```
GET  /                          Health check
GET  /search/arxiv?q=&limit=    Buscar en arXiv (caché 10 min)
GET  /search/scholar?q=&limit=  Buscar en Semantic Scholar (caché 10 min)
GET  /search/_stats             Stats de caché (dev)
POST /ai/claude                 Proxy a Anthropic API
POST /ai/gemini/:model          Proxy a Google AI API
```

## Deploy en Railway

1. Crea un proyecto nuevo en [railway.app](https://railway.app)
2. Conecta el repositorio y selecciona la carpeta `backend/`
3. Railway detecta Bun automáticamente gracias a `railway.toml`
4. Añade las variables de entorno en el panel de Railway:
   - `FRONTEND_URL` → tu URL de producción del frontend
   - `ANTHROPIC_API_KEY` / `GOOGLE_AI_KEY` (opcional)
5. En el frontend de producción, añade:
   ```
   VITE_API_URL=https://tu-backend.railway.app
   ```

El `railway.toml` ya incluye health check y restart policy.
