import { useCallback, useRef, useState } from 'react'
import type { DocEntry } from '../types'
import type { FullViewTarget } from './types'

export function useFullView(docs: DocEntry[]) {
  const [viewKey, setViewKey] = useState(0)
  const [fullView, setFullView] = useState<FullViewTarget | null>(null)
  const [hiddenPageId, setHiddenPageId] = useState<string | null>(null)
  const fullViewRef = useRef<FullViewTarget | null>(null)
  fullViewRef.current = fullView

  const docsRef = useRef(docs)
  docsRef.current = docs
  const remembered = useRef<Record<string, string>>({})
  const rememberPage = useCallback((pageId: string) => {
    const doc = docsRef.current.find((d) => d.pages.some((p) => p.id === pageId))
    if (doc) remembered.current[doc.id] = pageId
    setHiddenPageId(pageId)
  }, [])
  const openPage = useCallback((docId: string, pageId: string) => {
    setViewKey((k) => k + 1)
    remembered.current[docId] = pageId
    const el = fullViewRef.current
      ? null
      : document.querySelector(`[data-page-id="${CSS.escape(pageId)}"]`)
    const rect = el?.getBoundingClientRect()
    setFullView({
      docId,
      pageId,
      originRect: rect
        ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        : null
    })
    setHiddenPageId(pageId)
  }, [])

  const closeFullView = useCallback(() => {
    setFullView(null)
    setHiddenPageId(null)
  }, [])

  const activateDocument = useCallback(
    (id: string) => {
      const doc = docsRef.current.find((d) => d.id === id)
      const page = doc?.pages.find((p) => p.id === remembered.current[id]) ?? doc?.pages[0]
      if (page) openPage(id, page.id)
    },
    [openPage]
  )

  return {
    viewKey,
    activateDocument,
    fullView,
    fullViewRef,
    hiddenPageId,
    setHiddenPageId: rememberPage,
    openPage,
    closeFullView
  }
}
