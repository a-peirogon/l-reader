import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { Annotation, HighlightAnnotation, NoteAnnotation } from '@/types'

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

export async function exportWithAnnotations(
  pdfDoc: any,
  annotations: Annotation[],
  filename: string
): Promise<void> {
  const originalBytes = await pdfDoc.getData()
  const doc   = await PDFDocument.load(originalBytes)
  const pages = doc.getPages()
  const font  = await doc.embedFont(StandardFonts.Helvetica)

  for (const ann of annotations) {
    const pageIndex = ann.page - 1
    if (pageIndex < 0 || pageIndex >= pages.length) continue
      const page = pages[pageIndex]
      const { width: pw, height: ph } = page.getSize()
      const { r, g, b } = hexToRgb(ann.color)

      if (ann.type === 'highlight') {
        const a = ann as HighlightAnnotation
        page.drawRectangle({
          x: a.x * pw,
          y: ph - (a.y + a.height) * ph,
                           width:   a.width  * pw,
                           height:  a.height * ph,
                           color:   rgb(r, g, b),
                           opacity: 0.3,
        })
      } else if (ann.type === 'note') {
        const a = ann as NoteAnnotation
        if (!a.text) continue
          const nx = a.x * pw
          const ny = ph - a.y * ph - 16
          page.drawRectangle({ x: nx, y: ny, width: 14, height: 14, color: rgb(r, g, b) })
          page.drawText(a.text.slice(0, 200), {
            x: nx + 18, y: ny + 2,
            size: 9, font, color: rgb(r, g, b), opacity: 0.9,
                        maxWidth: pw - nx - 24,
          })
      }
  }

  const bytes = await doc.save()
  const blob  = new Blob([bytes], { type: 'application/pdf' })
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href      = url
  a.download  = filename.replace(/\.pdf$/i, '') + '_anotado.pdf'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
