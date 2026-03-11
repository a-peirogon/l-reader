import { Hono } from 'hono'

const pdf = new Hono()

// ─── PDF proxy ────────────────────────────────────────────────────────────────
// Fetches a remote PDF server-side and streams it back, bypassing browser CORS.
// Only allows known academic domains for safety.

const ALLOWED_ORIGINS = [
    'arxiv.org',
'export.arxiv.org',
'ar5iv.labs.arxiv.org',
'semanticscholar.org',
'pdfs.semanticscholar.org',
'openreview.net',
'aclanthology.org',
'proceedings.mlr.press',
'jmlr.org',
'pmlr.org',
'dl.acm.org',
'springer.com',
'link.springer.com',
'europepmc.org',
'biorxiv.org',
'medrxiv.org',
'plos.org',
'journals.plos.org',
]

function isAllowed(url: string): boolean {
    try {
        const host = new URL(url).hostname.replace(/^www\./, '')
        return ALLOWED_ORIGINS.some((o) => host === o || host.endsWith('.' + o))
    } catch {
        return false
    }
}

pdf.get('/fetch', async (c) => {
    const url = c.req.query('url')

    if (!url) return c.json({ error: 'Missing query param: url' }, 400)
        if (!isAllowed(url)) return c.json({ error: 'Domain not allowed' }, 403)

            let upstream: Response
            try {
                upstream = await fetch(url, {
                    headers: {
                        'User-Agent': 'Lectio/1.0 (academic PDF reader)',
                                       'Accept': 'application/pdf,*/*',
                    },
                    redirect: 'follow',
                })
                if (!upstream.ok) throw new Error(`Upstream returned ${upstream.status}`)
            } catch (err: any) {
                return c.json({ error: `PDF fetch failed: ${err.message}` }, 502)
            }

            const contentType = upstream.headers.get('content-type') ?? 'application/pdf'
if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
    return c.json({ error: `Not a PDF (content-type: ${contentType})` }, 415)
}

// Derive a filename from the URL
const filename = url.split('/').pop()?.split('?')[0] || 'paper.pdf'

return new Response(upstream.body, {
    headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
    },
})
})

export default pdf
