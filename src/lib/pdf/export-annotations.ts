import type { Annotation, HighlightAnnotation, NoteAnnotation } from '@/types'

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function baseName(docName: string) {
  return docName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9-_. ]/g, '_')
}

function sorted(annotations: Annotation[]) {
  return [...annotations].sort((a, b) => a.page - b.page || a.createdAt - b.createdAt)
}

// ─── Markdown ─────────────────────────────────────────────────────────────────

export function exportAnnotationsMarkdown(annotations: Annotation[], docName: string) {
  const lines: string[] = [
    `# Anotaciones — ${baseName(docName)}`,
    `*Exportado: ${new Date().toLocaleDateString('es', { dateStyle: 'long' })}*`,
    '',
  ]

  const highlights = sorted(annotations.filter(a => a.type === 'highlight')) as HighlightAnnotation[]
  const notes = sorted(annotations.filter(a => a.type === 'note')) as NoteAnnotation[]

  if (highlights.length) {
    lines.push('## Resaltados', '')
    let curPage = 0
    for (const a of highlights) {
      if (a.page !== curPage) {
        if (curPage) lines.push('')
        lines.push(`### p. ${a.page}`)
        curPage = a.page
      }
      if (a.text) {
        lines.push(`> ${a.text}`)
      } else {
        lines.push(`> *(resaltado sin texto)*`)
      }
    }
    lines.push('')
  }

  if (notes.length) {
    lines.push('## Notas', '')
    let curPage = 0
    for (const a of notes) {
      if (a.page !== curPage) {
        if (curPage) lines.push('')
        lines.push(`### p. ${a.page}`)
        curPage = a.page
      }
      lines.push(`**Nota:** ${a.text}`)
    }
    lines.push('')
  }

  download(lines.join('\n'), `${baseName(docName)}-anotaciones.md`, 'text/markdown')
}

// ─── BibTeX ───────────────────────────────────────────────────────────────────

export function exportAnnotationsBibTeX(annotations: Annotation[], docName: string) {
  const base = baseName(docName).replace(/\s+/g, '_').toLowerCase().slice(0, 20)
  const entries: string[] = []
  let i = 1

  for (const ann of sorted(annotations)) {
    const key = `${base}_ann${i++}`
    if (ann.type === 'highlight') {
      const ha = ann as HighlightAnnotation
      const fields = [
        `  type      = {highlight},`,
        `  source    = {${docName}},`,
        `  page      = {${ha.page}},`,
        ha.text ? `  quote     = {${ha.text.replace(/[{}]/g, '')}},` : null,
        `  color     = {${ha.color}},`,
        `  timestamp = {${new Date(ha.createdAt).toISOString()}},`,
      ].filter(Boolean).join('\n')
      entries.push(`@misc{${key},\n${fields}\n}`)
    } else if (ann.type === 'note') {
      const na = ann as NoteAnnotation
      const fields = [
        `  type      = {note},`,
        `  source    = {${docName}},`,
        `  page      = {${na.page}},`,
        `  note      = {${na.text.replace(/[{}]/g, '')}},`,
        `  timestamp = {${new Date(na.createdAt).toISOString()}},`,
      ].join('\n')
      entries.push(`@misc{${key},\n${fields}\n}`)
    }
  }

  download(entries.join('\n\n'), `${base}-anotaciones.bib`, 'text/plain')
}
