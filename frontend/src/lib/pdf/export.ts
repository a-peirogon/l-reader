import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { Annotation, HighlightAnnotation, TextAnnotation, DrawAnnotation, NoteAnnotation } from '@/types'

// Convert hex color to pdf-lib rgb (0-1 range)
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const n = parseInt(hex.slice(1), 16)
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

export async function exportWithAnnotations(
    pdfDoc: any, // pdfjsLib PDFDocumentProxy
    annotations: Annotation[],
    filename: string
): Promise<void> {
    // Get original PDF bytes from pdfjs
    const originalBytes = await pdfDoc.getData()

    // Load into pdf-lib
    const doc = await PDFDocument.load(originalBytes)
    const pages = doc.getPages()
    const font = await doc.embedFont(StandardFonts.Helvetica)

    for (const ann of annotations) {
        const pageIndex = ann.page - 1
        if (pageIndex < 0 || pageIndex >= pages.length) continue

            const page = pages[pageIndex]
            const { width: pw, height: ph } = page.getSize()
            const { r, g, b } = hexToRgb(ann.color)

            if (ann.type === 'highlight') {
                const a = ann as HighlightAnnotation
                // pdf-lib origin is bottom-left; pdfjs is top-left → flip Y
                page.drawRectangle({
                    x: a.x * pw,
                    y: ph - (a.y + a.height) * ph,
                                   width: a.width * pw,
                                   height: a.height * ph,
                                   color: rgb(r, g, b),
                                   opacity: 0.3,
                })
            } else if (ann.type === 'underline') {
                const a = ann as HighlightAnnotation
                const lineY = ph - (a.y + a.height) * ph
                page.drawLine({
                    start: { x: a.x * pw, y: lineY },
                    end: { x: (a.x + a.width) * pw, y: lineY },
                              thickness: 1.5,
                              color: rgb(r, g, b),
                              opacity: 0.85,
                })
            } else if (ann.type === 'text') {
                const a = ann as TextAnnotation
                if (!a.text) continue
                    page.drawText(a.text, {
                        x: a.x * pw,
                        y: ph - a.y * ph - a.fontSize,
                        size: a.fontSize,
                        font,
                        color: rgb(r, g, b),
                                  opacity: 0.9,
                    })
            } else if (ann.type === 'draw') {
                const a = ann as DrawAnnotation
                if (a.points.length < 2) continue
                    // Draw as series of lines between consecutive points
                    for (let i = 0; i < a.points.length - 1; i++) {
                        const [x1, y1] = a.points[i]
                        const [x2, y2] = a.points[i + 1]
                        page.drawLine({
                            start: { x: x1 * pw, y: ph - y1 * ph },
                            end:   { x: x2 * pw, y: ph - y2 * ph },
                            thickness: a.strokeWidth,
                            color: rgb(r, g, b),
                                      opacity: 0.85,
                        })
                    }
            } else if (ann.type === 'note') {
                const a = ann as NoteAnnotation
                if (!a.text) continue
                    // Draw a small colored square + text
                    const nx = a.x * pw, ny = ph - a.y * ph - 16
                    page.drawRectangle({ x: nx, y: ny, width: 14, height: 14, color: rgb(r, g, b) })
                    page.drawText(a.text.slice(0, 200), {
                        x: nx + 18, y: ny + 2,
                        size: 9, font, color: rgb(r, g, b), opacity: 0.9,
                                  maxWidth: pw - nx - 24,
                    })
            }
    }

    const bytes = await doc.save()
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = filename.replace(/\.pdf$/i, '') + '_anotado.pdf'
    a.click()

    setTimeout(() => URL.revokeObjectURL(url), 5000)
}
