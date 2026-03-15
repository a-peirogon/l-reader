import { useEffect, useCallback } from 'react'
import { useLectioStore } from '@/store'
import type { Annotation } from '@/types'

// Derive a stable storage key from the document filename
export function docId(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()
}

const LS_PREFIX = 'lectio_ann_'

// ── Persistence ───────────────────────────────────────────────────────────────

function loadFromStorage(id: string): Annotation[] {
  try {
    const raw = localStorage.getItem(LS_PREFIX + id)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(id: string, anns: Annotation[]): void {
  try {
    localStorage.setItem(LS_PREFIX + id, JSON.stringify(anns))
  } catch {
    // storage full or unavailable — fail silently
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAnnotations() {
  const {
    pdf,
    annotations,
    setDocAnnotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    setAnnotationTool,
    setAnnotationColor,
    setAnnotationStrokeWidth,
  } = useLectioStore()

  const currentDocId = pdf.name ? docId(pdf.name) : ''

  // Load from localStorage when document changes
  useEffect(() => {
    if (!currentDocId) return
    const stored = loadFromStorage(currentDocId)
    setDocAnnotations(currentDocId, stored)
  }, [currentDocId, setDocAnnotations])

  // Persist to localStorage whenever annotations change
  const docAnns = annotations.byDoc[currentDocId] ?? []
  useEffect(() => {
    if (!currentDocId) return
    saveToStorage(currentDocId, docAnns)
  }, [currentDocId, docAnns])

  // Page-specific annotations
  const forPage = useCallback(
    (page: number) => docAnns.filter((a) => a.page === page),
    [docAnns]
  )

  const add = useCallback(
    (ann: Annotation) => {
      if (!currentDocId) return
      addAnnotation(currentDocId, ann)
    },
    [currentDocId, addAnnotation]
  )

  const update = useCallback(
    (id: string, patch: Partial<Annotation>) => {
      if (!currentDocId) return
      updateAnnotation(currentDocId, id, patch)
    },
    [currentDocId, updateAnnotation]
  )

  const remove = useCallback(
    (id: string) => {
      if (!currentDocId) return
      deleteAnnotation(currentDocId, id)
    },
    [currentDocId, deleteAnnotation]
  )

  const clearAll = useCallback(() => {
    if (!currentDocId) return
    setDocAnnotations(currentDocId, [])
  }, [currentDocId, setDocAnnotations])

  return {
    tool: annotations.tool,
    color: annotations.color,
    strokeWidth: annotations.strokeWidth,
    allAnnotations: docAnns,
    forPage,
    add,
    update,
    remove,
    clearAll,
    setTool: setAnnotationTool,
    setColor: setAnnotationColor,
    setStrokeWidth: setAnnotationStrokeWidth,
    docId: currentDocId,
  }
}
