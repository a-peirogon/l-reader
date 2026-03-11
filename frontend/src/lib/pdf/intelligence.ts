import type { DocIndex, DocSection } from '@/types'

// ─── Stopwords ───────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'de','la','el','en','y','a','que','los','se','del','las','un','por',
  'con','una','su','para','es','al','lo','como','más','pero','sus','le',
  'ya','o','fue','este','ha','si','sobre','entre','cuando','esta','son',
  'the','of','and','to','in','is','it','that','for','on','are','as',
  'with','his','they','at','be','this','from','or','an','have','by','not',
  'but','what','all','were','we','when','your','can','said','there','use',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-záéíóúüña-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
}

// ─── TF-IDF ──────────────────────────────────────────────────────────────────

export function buildTFIDF(
  pageTexts: Record<number, string>
): Record<string, Record<number, number>> {
  const N = Object.keys(pageTexts).length
  const tf: Record<number, Record<string, number>> = {}
  const df: Record<string, number> = {}

  for (const [pStr, text] of Object.entries(pageTexts)) {
    const n = parseInt(pStr)
    const words = tokenize(text)
    tf[n] = {}
    const seen = new Set<string>()
    for (const w of words) {
      tf[n][w] = (tf[n][w] || 0) + 1
      if (!seen.has(w)) {
        df[w] = (df[w] || 0) + 1
        seen.add(w)
      }
    }
    const total = words.length || 1
    for (const w in tf[n]) tf[n][w] /= total
  }

  const tfidf: Record<string, Record<number, number>> = {}
  for (const [pStr, freqs] of Object.entries(tf)) {
    const n = parseInt(pStr)
    for (const [w, f] of Object.entries(freqs)) {
      const idf = Math.log((N + 1) / ((df[w] || 1) + 1)) + 1
      if (!tfidf[w]) tfidf[w] = {}
      tfidf[w][n] = f * idf
    }
  }

  return tfidf
}

// ─── Section detection ───────────────────────────────────────────────────────

const HEADING_RE = /^(\d+[\.\)]\s+|[A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ\s]{2,60}$|#{1,3}\s)/m

function topWords(pages: number[], pageTexts: Record<number, string>, k = 5): string[] {
  const freq: Record<string, number> = {}
  for (const n of pages) {
    for (const w of tokenize(pageTexts[n] || '')) freq[w] = (freq[w] || 0) + 1
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([w]) => w)
}

export function detectSections(
  pageTexts: Record<number, string>,
  totalPages: number
): DocSection[] {
  const sections: DocSection[] = []
  let cur: DocSection = { pages: [], heading: '', snippet: '', keywords: [] }

  for (let n = 1; n <= totalPages; n++) {
    const text = pageTexts[n] || ''
    const firstLine = text.split(/\n|\.\s/)[0]?.trim() || ''
    const isHeading = firstLine.length < 120 && HEADING_RE.test(firstLine)

    if (isHeading && cur.pages.length > 0) {
      cur.snippet = (pageTexts[cur.pages[0]] || '').slice(0, 200)
      cur.keywords = topWords(cur.pages, pageTexts)
      sections.push(cur)
      cur = { pages: [], heading: firstLine, snippet: '', keywords: [] }
    } else if (cur.pages.length === 0) {
      cur.heading = firstLine
    }
    cur.pages.push(n)
  }

  if (cur.pages.length) {
    cur.snippet = (pageTexts[cur.pages[0]] || '').slice(0, 200)
    cur.keywords = topWords(cur.pages, pageTexts)
    sections.push(cur)
  }

  return sections
}

// ─── Retrieval ───────────────────────────────────────────────────────────────

export function retrievePages(
  query: string,
  index: DocIndex,
  currentPage: number,
  totalPages: number,
  k = 3
): number[] {
  const qTokens = tokenize(query)
  if (!qTokens.length) return nearbyPages(currentPage, totalPages, k)

  const scores: Record<string, number> = {}
  for (const w of qTokens) {
    const entries = index.tfidf[w] || {}
    for (const [pStr, weight] of Object.entries(entries)) {
      scores[pStr] = (scores[pStr] || 0) + weight
    }
  }

  // Boost nearby pages
  for (let d = -2; d <= 2; d++) {
    const p = currentPage + d
    if (p >= 1 && p <= totalPages) {
      const boost = 0.3 - Math.abs(d) * 0.07
      scores[p] = (scores[p] || 0) + boost
    }
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([p]) => parseInt(p))
    .sort((a, b) => a - b)
}

export function nearbyPages(current: number, total: number, k: number): number[] {
  const pages: number[] = []
  for (let d = 0; d <= k; d++) {
    if (current - d >= 1) pages.push(current - d)
    if (d > 0 && current + d <= total) pages.push(current + d)
    if (pages.length >= k) break
  }
  return pages.slice(0, k).sort((a, b) => a - b)
}
