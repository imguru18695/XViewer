import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { computeLayout } from './canvas/layout'
import { Toolbar } from './components/Toolbar'
import { DocumentTabs } from './components/DocumentTabs'
import { FullView } from './components/FullView'
import { CollectionCanvas } from './components/CollectionCanvas'
import type { CanvasHandle } from './components/Canvas'
import { useCollection } from './app/useCollection'
import { useFullView } from './app/useFullView'
import { useMarks } from './app/useMarks'
import { useFormValues } from './app/useFormValues'
import { useElements } from './app/useElements'
import { ACTIONS, useUndoStack } from './app/undo'
import { flipPages } from './canvas/flip-pages'
import { useExport } from './app/useExport'
import { useImport } from './app/useImport'
import { usePaste } from './app/usePaste'
import { useDragController } from './app/useDragController'
import { useKeyboardShortcuts } from './app/useKeyboardShortcuts'
import { useFind } from './app/useFind'
import { useSearchIndex } from './search/useSearchIndex'
import { FindProvider } from './search/FindContext'
import { FindBar } from './components/FindBar'
import { useAiBridge } from './app/ai-bridge/useAiBridge'
import { useAiChat } from './ai/useAiChat'
import { resolveAiConfig } from './ai/provider'
import { computeAiFocus } from './ai/focus'
import { useAiActivity } from './ai/activity/useAiActivity'
import { withActivity } from './ai/activity/tracker'
import { AiActivityProvider } from './ai/activity/context'
import { AiChatPanel } from './components/ai/AiChatPanel'

const TOAST_MS = 4000

export default function App(): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [scale, setScale] = useState(1)
  const [renderVersion, setRenderVersion] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canvasRef = useRef<CanvasHandle | null>(null)

  const flash = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  const undoStack = useUndoStack()
  const markState = useMarks(undoStack.push)
  const formState = useFormValues()
  const elementState = useElements(undoStack.push)
  const collection = useCollection(flash, undoStack.push)
  const docs = collection.docs
  const fullViewState = useFullView(docs)
  const activeDocId =
    docs.find((d) => d.pages.some((p) => p.id === fullViewState.hiddenPageId))?.id ??
    fullViewState.fullView?.docId ??
    docs[0]?.id ??
    ''
  const closeDocument = (id: string) => {
    if (busy) return
    const index = docs.findIndex((d) => d.id === id)
    const doc = docs[index]
    if (!doc) return
    const edited = doc.pages.some(
      (p) =>
        markState.marks[p.id]?.length ||
        elementState.elements[p.id]?.length ||
        Object.keys(formState.values[p.source.id] ?? {}).length
    )
    if (
      edited &&
      !window.confirm(
        `Close ${doc.name}? Unsaved edits will be discarded. Save a copy first to keep them.`
      )
    )
      return
    if (id === activeDocId) {
      const next = docs[index + 1] ?? docs[index - 1]
      if (next) fullViewState.activateDocument(next.id)
      else fullViewState.closeFullView()
    }
    if (id !== activeDocId && fullViewState.fullView) fullViewState.activateDocument(activeDocId)
    collection.removeDoc(id)
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !docs.length || busy) return
      if (event.key === 'Tab') {
        event.preventDefault()
        const index = docs.findIndex((d) => d.id === activeDocId)
        fullViewState.activateDocument(
          docs[(index + (event.shiftKey ? docs.length - 1 : 1)) % docs.length].id
        )
      } else if (event.key.toLowerCase() === 'w') {
        event.preventDefault()
        closeDocument(activeDocId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const documentTabs = (
    <DocumentTabs
      docs={docs}
      activeId={activeDocId}
      onSelect={fullViewState.activateDocument}
      onClose={closeDocument}
    />
  )
  const layout = useMemo(() => computeLayout(docs), [docs])

  const searchIndex = useSearchIndex(docs, elementState.elements)

  const [aiOpen, setAiOpen] = useState(false)
  const aiEnabled = useMemo(() => resolveAiConfig().ready, [])
  const aiFocus = useMemo(
    () => computeAiFocus(docs, collection.selected, fullViewState.hiddenPageId),
    [docs, collection.selected, fullViewState.hiddenPageId]
  )
  const aiActivity = useAiActivity()
  const { getOcrWords, ocrStatus } = searchIndex
  const aiOcr = useMemo(() => ({ getOcrWords, ocrStatus }), [getOcrWords, ocrStatus])
  const aiBridge = useAiBridge(collection, elementState, formState, markState, aiOcr, aiFocus)
  const trackedAiBridge = useMemo(
    () => withActivity(aiBridge, aiActivity.tracker),
    [aiBridge, aiActivity.tracker]
  )
  const aiChat = useAiChat(trackedAiBridge)
  const { busy: aiBusy } = aiChat
  const { clear: clearAiActivity } = aiActivity
  useEffect(() => {
    if (!aiBusy) clearAiActivity()
  }, [aiBusy, clearAiActivity])

  const find = useFind(searchIndex.search, searchIndex.version)
  const findState = useMemo(
    () => ({
      active: find.active,
      query: find.matchedQuery,
      matchingDocIds: find.result.docIds,
      matchingPageIds: find.result.pageIds,
      getOcrWords: searchIndex.getOcrWords
    }),
    [find.active, find.matchedQuery, find.result, searchIndex.getOcrWords]
  )

  const { exportCollection, exportZip, saveDocument, printDocument } = useExport(
    docs,
    markState.marks,
    formState.values,
    elementState.elements,
    setBusy,
    flash
  )
  const { addFiles, openViaDialog, addPagesToDoc, handleExternalDropFiles } = useImport(
    collection,
    setBusy,
    flash,
    fullViewState.openPage
  )
  const { handlePaste } = usePaste(collection, addFiles, setBusy, flash)

  const drag = useDragController({
    layout,
    canvasRef,
    movePageInto: collection.movePageInto,
    movePageToNewDoc: collection.movePageToNewDoc,
    onExternalDrop: handleExternalDropFiles
  })

  const onPaste = useCallback(() => void handlePaste(), [handlePaste])
  const { undo: popUndo, redo: popRedo } = undoStack
  const { applyUndo: applyMarkUndo, applyRedo: applyMarkRedo } = markState
  const { applyUndo: applyElementUndo, applyRedo: applyElementRedo } = elementState
  const { placePageAt, applyPageSource } = collection
  const onUndo = useCallback(() => {
    const entry = popUndo()
    if (!entry) return
    if (entry.action === ACTIONS.MARK) applyMarkUndo(entry)
    else if (entry.action === ACTIONS.ELEMENT) applyElementUndo(entry)
    else if (entry.action === ACTIONS.PAGE_SOURCE) applyPageSource(entry, 'undo')
    else flipPages(() => placePageAt(entry.payload.pageId, entry.payload.from))
  }, [popUndo, applyMarkUndo, applyElementUndo, applyPageSource, placePageAt])
  const onRedo = useCallback(() => {
    const entry = popRedo()
    if (!entry) return
    if (entry.action === ACTIONS.MARK) applyMarkRedo(entry)
    else if (entry.action === ACTIONS.ELEMENT) applyElementRedo(entry)
    else if (entry.action === ACTIONS.PAGE_SOURCE) applyPageSource(entry, 'redo')
    else flipPages(() => placePageAt(entry.payload.pageId, entry.payload.to))
  }, [popRedo, applyMarkRedo, applyElementRedo, applyPageSource, placePageAt])

  useKeyboardShortcuts({
    active: !fullViewState.fullView,
    selected: collection.selected,
    onDeletePage: collection.deletePage,
    onCopy: collection.copySelected,
    onPaste,
    onUndo,
    onRedo,
    onClearSelection: collection.clearSelection,
    findOpen: find.open,
    onOpenFind: find.openFind,
    onCloseFind: find.closeFind
  })

  const onScaleChange = useCallback((next: number) => setScale(next), [])
  const onSettle = useCallback(() => setRenderVersion((v) => v + 1), [])

  const fullViewRef = fullViewState.fullViewRef
  useEffect(() => {
    return window.api.onZoom((action) => {
      if (fullViewRef.current) return
      if (action === 'in') canvasRef.current?.zoomIn()
      else if (action === 'out') canvasRef.current?.zoomOut()
      else canvasRef.current?.reset()
    })
  }, [fullViewRef])

  useEffect(() => {
    return window.api.onMenu((action) => {
      if (action === 'open') void openViaDialog()
      else if (action === 'export-pdfx') void exportCollection('pdfx')
      else if (action === 'export-pdf') void exportCollection('pdf')
      else if (action === 'export-zip') void exportZip()
      else if (action === 'print') {
        const active = docs.find((d) => d.pages.some((p) => p.id === fullViewState.hiddenPageId))
        void printDocument(active?.id ?? collection.selected?.docId)
      } else if (action === 'save') {
        const active = docs.find((d) => d.pages.some((p) => p.id === fullViewState.hiddenPageId))
        const id = active?.id ?? collection.selected?.docId ?? docs[0]?.id
        if (id) void saveDocument(id)
      }
    })
  }, [
    openViaDialog,
    exportCollection,
    exportZip,
    printDocument,
    saveDocument,
    docs,
    fullViewState.hiddenPageId,
    collection.selected
  ])

  const totalPages = docs.reduce((sum, d) => sum + d.pages.length, 0)
  const { fullView } = fullViewState
  const fullViewDoc = fullView ? docs.find((d) => d.id === fullView.docId) : undefined

  return (
    <FindProvider value={findState}>
      <AiActivityProvider value={aiActivity.view}>
        <div
          className={
            'app' + (drag.committing ? ' committing' : '') + (drag.dragKind ? ' dragging' : '')
          }
          onDragEnter={drag.handlers.onDragEnter}
          onDragOver={drag.handlers.onDragOver}
          onDragLeave={drag.handlers.onDragLeave}
          onDrop={drag.handlers.onDrop}
        >
          <Toolbar
            documentTabs={!fullViewState.fullView && docs.length ? documentTabs : null}
            documentCount={docs.length}
            pageCount={totalPages}
            busy={busy}
            zoom={scale}
            aiOpen={aiOpen}
            aiEnabled={aiEnabled}
            onZoomIn={() => canvasRef.current?.zoomIn()}
            onZoomOut={() => canvasRef.current?.zoomOut()}
            onZoomReset={() => canvasRef.current?.reset()}
            onOpen={openViaDialog}
            onExportPdf={() => exportCollection('pdf')}
            onExportZip={exportZip}
            onPrint={() => printDocument(collection.selected?.docId)}
            onRead={() => {
              const doc = docs.find((d) => d.id === collection.selected?.docId) ?? docs[0]
              if (doc)
                fullViewState.openPage(doc.id, collection.selected?.pageId ?? doc.pages[0].id)
            }}
            onToggleAi={() => setAiOpen((open) => !open)}
          />

          {find.open && (
            <FindBar
              query={find.query}
              result={find.result}
              ocrRemaining={searchIndex.ocrRemaining}
              hasScanned={searchIndex.hasScanned}
              ocrLanguage={searchIndex.ocrLanguage}
              onQuery={find.setQuery}
              onOcrLanguage={searchIndex.setOcrLanguage}
              onClose={find.closeFind}
              onNavigate={(direction) => {
                const matching = docs.flatMap((doc) =>
                  doc.pages
                    .filter((p) => find.result.pageIds.has(p.id))
                    .map((page) => ({ doc, page }))
                )
                if (!matching.length) return
                const index = matching.findIndex((m) => m.page.id === fullViewState.hiddenPageId)
                const next =
                  index < 0
                    ? direction === 1
                      ? 0
                      : matching.length - 1
                    : (index + direction + matching.length) % matching.length
                fullViewState.openPage(matching[next].doc.id, matching[next].page.id)
              }}
            />
          )}

          <CollectionCanvas
            docs={docs}
            layout={layout}
            busy={busy}
            pagesDraggable={totalPages >= 2}
            renderVersion={renderVersion}
            selected={collection.selected}
            hiddenPageId={fullViewState.hiddenPageId}
            marks={markState.marks}
            formValues={formState.values}
            elements={elementState.elements}
            dragKind={drag.dragKind}
            draggingPage={drag.draggingPage}
            dropTarget={drag.dropTarget}
            collapsedId={drag.collapsedId}
            externalCount={drag.externalCount}
            canvasRef={canvasRef}
            onScaleChange={onScaleChange}
            onSettle={onSettle}
            onBackgroundClick={collection.clearSelection}
            onOpen={openViaDialog}
            onSelectPage={collection.selectPage}
            onOpenPage={fullViewState.openPage}
            onPageDragStart={drag.startPageDrag}
            onPageDragEnd={drag.clearDrag}
            onAddPage={addPagesToDoc}
            onMoveDoc={collection.moveDoc}
            onRemoveDoc={collection.removeDoc}
            onRenameDoc={collection.renameDoc}
          />

          {fullView && fullViewDoc && (
            <FullView
              documentTabs={documentTabs}
              onOpenFiles={addFiles}
              key={`${fullViewState.viewKey}:${docs.map((d) => d.id).join(',')}`}
              docs={docs}
              startDocId={activeDocId}
              startPageId={fullViewState.hiddenPageId ?? fullView.pageId}
              originRect={fullView.originRect}
              marks={markState.marks}
              onToggleMark={markState.toggleMark}
              onRestoreMarks={markState.restoreMarks}
              formValues={formState.values}
              onFieldChange={formState.setFieldValue}
              elements={elementState.elements}
              onAddInk={elementState.addInk}
              onAddText={elementState.addText}
              onRemoveElement={elementState.removeElement}
              onMoveElement={elementState.moveElement}
              onAddImage={elementState.addImage}
              onResizeImage={elementState.resizeImage}
              onReplaceImage={elementState.replaceImage}
              onPrint={printDocument}
              onSave={saveDocument}
              onFind={find.openFind}
              onOpen={openViaDialog}
              onUndo={onUndo}
              onRedo={onRedo}
              flash={flash}
              busy={busy}
              onToggleTextMark={elementState.toggleTextMark}
              onUpdateText={elementState.updateText}
              onActivePageChange={fullViewState.setHiddenPageId}
              onClose={fullViewState.closeFullView}
            />
          )}

          <AnimatePresence>
            {aiOpen && (
              <AiChatPanel
                messages={aiChat.messages}
                busy={aiChat.busy}
                onSend={aiChat.send}
                onClose={() => setAiOpen(false)}
              />
            )}
          </AnimatePresence>

          {toast && <div className="toast">{toast}</div>}
        </div>
      </AiActivityProvider>
    </FindProvider>
  )
}
