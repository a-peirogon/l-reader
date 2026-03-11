import { Hono } from 'hono'
import { TTLCache } from '../cache'

const search = new Hono()

// Shared cache: 10 min TTL for search results
const cache = new TTLCache<any[]>(10)

// ─── arXiv ───────────────────────────────────────────────────────────────────

search.get('/arxiv', async (c) => {
  const q = c.req.query('q')?.trim()
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 25)

  if (!q) return c.json({ error: 'Missing query param: q' }, 400)

    const cacheKey = `arxiv:${q}:${limit}`
    const cached = cache.get(cacheKey)
    if (cached) return c.json({ results: cached, cached: true })

      const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&max_results=${limit}&sortBy=relevance`

      let xml: string
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Lectio/1.0 (academic reader)' },
        })
        if (!res.ok) throw new Error(`arXiv returned ${res.status}`)
          xml = await res.text()
      } catch (err: any) {
        return c.json({ error: `arXiv fetch failed: ${err.message}` }, 502)
      }

      // Parse Atom XML — wrapped so any regex/parse error returns a clean 500
      let results: any[]
      try {
        const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]

        results = entries.map((match) => {
          const entry = match[1]

          const id = (entry.match(/<id>(.*?)<\/id>/)?.[1] ?? '')
          .replace('http://arxiv.org/abs/', '')
          .replace('https://arxiv.org/abs/', '')
          .trim()

          const title = (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
          .replace(/\s+/g, ' ').trim()

          const abstract = (entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? '')
          .replace(/\s+/g, ' ').trim()

          const published = entry.match(/<published>(.*?)<\/published>/)?.[1] ?? ''
        const year = published ? parseInt(published.slice(0, 4)) : undefined

        // Match <name> inside <author> blocks
        const authors = [...entry.matchAll(/<name>(.*?)<\/name>/g)]
        .map((m) => m[1].trim())

        const categories = [...entry.matchAll(/<category[^>]*term="([^"]+)"[^>]*\/?>/g)]
        .map((m) => m[1])

        return {
          id: `arxiv-${id}`,
          source: 'arxiv',
          title,
          authors,
          year,
          abstract,
          categories,
          url: `https://arxiv.org/abs/${id}`,
          pdfUrl: `https://arxiv.org/pdf/${id}`,
        }
        })
      } catch (err: any) {
        return c.json({ error: `arXiv parse failed: ${err.message}` }, 500)
      }

      cache.set(cacheKey, results)
      return c.json({ results, cached: false })
})

// ─── Semantic Scholar ─────────────────────────────────────────────────────────

search.get('/scholar', async (c) => {
  const q = c.req.query('q')?.trim()
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 25)

  if (!q) return c.json({ error: 'Missing query param: q' }, 400)

    const cacheKey = `scholar:${q}:${limit}`
    const cached = cache.get(cacheKey)
    if (cached) return c.json({ results: cached, cached: true })

      const fields = 'title,authors,year,abstract,externalIds,openAccessPdf,citationCount'
const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&fields=${fields}&limit=${limit}`

let data: any
try {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Lectio/1.0 (academic reader)' },
  })
  if (!res.ok) throw new Error(`Scholar returned ${res.status}`)
    data = await res.json()
} catch (err: any) {
  return c.json({ error: `Scholar fetch failed: ${err.message}` }, 502)
}

let results: any[]
try {
  results = (data.data ?? []).map((p: any) => {
    const arxivId = p.externalIds?.ArXiv
    const doi = p.externalIds?.DOI
    const paperId = p.paperId

    const paperUrl = arxivId
    ? `https://arxiv.org/abs/${arxivId}`
    : doi
    ? `https://doi.org/${doi}`
    : `https://www.semanticscholar.org/paper/${paperId}`

    return {
      id: `s2-${paperId}`,
      source: 'scholar',
      title: p.title ?? '',
      authors: (p.authors ?? []).map((a: any) => a.name ?? ''),
                                  year: p.year,
                                  abstract: p.abstract ?? '',
                                  citationCount: p.citationCount,
                                  url: paperUrl,
                                  pdfUrl: p.openAccessPdf?.url ?? null,
    }
  })
} catch (err: any) {
  return c.json({ error: `Scholar parse failed: ${err.message}` }, 500)
}

cache.set(cacheKey, results)
return c.json({ results, cached: false })
})

// ─── Cache stats (dev utility) ────────────────────────────────────────────────

search.get('/_stats', (c) => c.json(cache.stats()))

export default search
