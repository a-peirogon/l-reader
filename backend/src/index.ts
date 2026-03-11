import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import search from './routes/search'
import ai from './routes/ai'
import pdf from './routes/pdf'

const app = new Hono()

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use('*', logger())

app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow localhost (any port) in dev + configured prod origin
      const allowed = [
        process.env.FRONTEND_URL ?? '',
        'http://localhost:5173',
        'http://localhost:4173',
      ].filter(Boolean)

      if (!origin || allowed.some((o) => origin.startsWith(o))) return origin
        return null
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'x-claude-key', 'x-gemini-key'],
    maxAge: 86400,
  })
)

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/', (c) =>
c.json({
  name: 'lectio-backend',
  version: '1.0.0',
  routes: ['/search/arxiv', '/search/scholar', '/ai/claude', '/ai/gemini/:model', '/pdf/fetch'],
})
)

// ─── Routes ───────────────────────────────────────────────────────────────────

app.route('/search', search)
app.route('/ai', ai)
app.route('/pdf', pdf)

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001')

export default {
  port: PORT,
  fetch: app.fetch,
}

console.log(`🚀 Lectio backend running on http://localhost:${PORT}`)
