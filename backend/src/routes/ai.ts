import { Hono } from 'hono'

const ai = new Hono()

// ─── Claude proxy ─────────────────────────────────────────────────────────────

ai.post('/claude', async (c) => {
  // Key priority: env var (server-side) → client-provided header (fallback)
  const apiKey = process.env.ANTHROPIC_API_KEY || c.req.header('x-claude-key') || ''

  if (!apiKey) {
    return c.json({ error: 'No Anthropic API key configured' }, 401)
  }

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return c.json(data, res.status as any)
  } catch (err: any) {
    return c.json({ error: `Claude proxy failed: ${err.message}` }, 502)
  }
})

// ─── Gemini proxy ─────────────────────────────────────────────────────────────

ai.post('/gemini/:model', async (c) => {
  const apiKey = process.env.GOOGLE_AI_KEY || c.req.header('x-gemini-key') || ''
  const model = c.req.param('model')

  if (!apiKey) {
    return c.json({ error: 'No Google AI API key configured' }, 401)
  }

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return c.json(data, res.status as any)
  } catch (err: any) {
    return c.json({ error: `Gemini proxy failed: ${err.message}` }, 502)
  }
})

export default ai
