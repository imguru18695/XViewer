import { useEffect, useRef, useState } from 'react'
import type { IncomingFile } from '../app/types'
import { isDroppableFile } from '../app/drop-items'
import type { DocEntry } from '../types'
import type { MarkKind, MarkMap, MarkRect } from '../edit/types'
import { isMarkTool } from '../edit/types'
import type { FieldValue, FormValuesBySource } from '../forms/types'
import type {
  ElementMap,
  ElementPoint,
  ElementRect,
  ImageAsset,
  PageElement
} from '../elements/types'
import { readImageAsset, resizedImageBox } from '../elements/image'
import { PageView } from './PageView'
import type { TextSpan } from '../elements/text-marks'
import type { Rect } from './full-view/geometry'
import { useElementSelection } from './full-view/use-element-selection'
import { useFullViewState } from './full-view/use-full-view-state'
import { useFullViewControls } from './full-view/use-full-view-controls'
import { useFullViewLayout } from './full-view/use-full-view-layout'
import { useFullViewEffects } from './full-view/use-full-view-effects'
import { useFullViewInput } from './full-view/use-full-view-input'
import { useEditMode } from './full-view/edit/use-edit-mode'
import { ToolCursor } from './full-view/edit/ToolCursor'
import { FullViewChrome } from './full-view/FullViewChrome'
import { FullViewPages } from './full-view/FullViewPages'

interface FullViewProps {
  documentTabs: React.ReactNode
  onOpenFiles: (files: IncomingFile[]) => Promise<void>
  docs: DocEntry[]
  startDocId: string
  startPageId: string
  originRect: Rect | null
  marks: MarkMap
  onToggleMark: (pageId: string, kind: MarkKind, rects: MarkRect[]) => void
  onRestoreMarks: (map: MarkMap) => void
  formValues: FormValuesBySource
  onFieldChange: (sourceId: string, fieldName: string, value: FieldValue) => void
  elements: ElementMap
  onAddInk: (pageId: string, points: ElementPoint[], pageWidth: number, pageHeight: number) => void
  onAddText: (
    pageId: string,
    text: string,
    origin: ElementPoint,
    pageWidth: number,
    pageHeight: number
  ) => void
  onRemoveElement: (pageId: string, elementId: string) => void
  onMoveElement: (pageId: string, elementId: string, dx: number, dy: number) => void
  onAddImage: (pageId: string, asset: ImageAsset, pw: number, ph: number) => PageElement | null
  onResizeImage: (pageId: string, elementId: string, box: ElementRect) => void
  onReplaceImage: (
    pageId: string,
    elementId: string,
    asset: ImageAsset,
    pw: number,
    ph: number
  ) => void
  onPrint: (docId: string) => void
  onSave: (docId: string) => void
  onFind: () => void
  onOpen: () => void
  onUndo: () => void
  onRedo: () => void
  flash: (message: string) => void
  busy: boolean
  onToggleTextMark: (pageId: string, elementId: string, kind: MarkKind, span: TextSpan) => void
  onUpdateText: (
    pageId: string,
    elementId: string,
    text: string,
    pageWidth: number,
    pageHeight: number
  ) => void
  onActivePageChange: (pageId: string) => void
  onClose: () => void
}

export function FullView({
  docs,
  startDocId,
  startPageId,
  originRect,
  marks,
  onToggleMark,
  onRestoreMarks,
  formValues,
  onFieldChange,
  elements,
  onAddInk,
  onAddText,
  onRemoveElement,
  onMoveElement,
  onToggleTextMark,
  onUpdateText,
  onActivePageChange,
  onClose,
  ...extra
}: FullViewProps): React.JSX.Element {
  const s = useFullViewState(docs, startDocId, startPageId, originRect)
  const edit = useEditMode(marks, onRestoreMarks)
  const selection = useElementSelection(edit.editing && isMarkTool(edit.tool), onRemoveElement)
  const [thumbnails, setThumbnails] = useState(true)
  const imageInput = useRef<HTMLInputElement>(null)
  const replaceTarget = useRef<string | null>(null)
  const selectedImage = elements[s.page.id]?.find(
    (e) => e.id === selection.selected?.elementId && e.kind === 'image'
  )
  useEffect(() => selection.selectElement(s.page.id, null), [s.page.id, selection.selectElement])

  useEffect(() => {
    if (!edit.editing || !edit.tool) return
    const active = document.activeElement
    if (
      active instanceof HTMLElement &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    ) {
      active.blur()
    }
  }, [edit.editing, edit.tool])

  const controls = useFullViewControls({
    scrollRef: s.scrollRef,
    closingRef: s.closingRef,
    editingRef: edit.editingRef,
    docsRef: s.docsRef,
    vpRef: s.vpRef,
    curRef: s.curRef,
    phaseRef: s.phaseRef,
    setView: s.setView,
    setPhase: s.setPhase,
    setFlip: s.setFlip,
    setFlipTransition: s.setFlipTransition,
    setRevealed: s.setRevealed,
    setCurrent: s.setCurrent,
    onClose
  })

  const { resetView } = controls
  useEffect(() => {
    if (!edit.editing) resetView()
  }, [edit.editing, resetView])

  useFullViewLayout({
    scrollRef: s.scrollRef,
    curRef: s.curRef,
    originRect,
    vw: s.vw,
    vh: s.vh,
    setPhase: s.setPhase,
    setFlip: s.setFlip,
    setFlipTransition: s.setFlipTransition,
    setRevealed: s.setRevealed
  })
  useFullViewEffects({
    scrollRef: s.scrollRef,
    scrollRaf: s.scrollRaf,
    docsRef: s.docsRef,
    vpRef: s.vpRef,
    pageId: s.page.id,
    onActivePageChange,
    vw: s.vw,
    vh: s.vh,
    fit: s.fit,
    view: s.view,
    curDi: s.current.di,
    curPi: s.current.pi,
    setViewport: s.setViewport,
    setView: s.setView,
    setCurrent: s.setCurrent,
    setRenderVersion: s.setRenderVersion
  })
  useFullViewInput({
    scrollRef: s.scrollRef,
    zoomedRef: s.zoomedRef,
    phaseRef: s.phaseRef,
    editingRef: edit.editingRef,
    finishEdit: edit.finishEdit,
    ...controls
  })

  const animating = s.phase !== 'open'
  const chromeOpacity = s.revealed ? 1 : 0

  return (
    <div
      className="full-view"
      role="dialog"
      aria-label="PDF page editor"
      data-phase={s.phase}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = extra.busy ? 'none' : 'copy'
        }
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        e.stopPropagation()
        if (extra.busy) return
        const files = Array.from(e.dataTransfer.files)
        const paths = files.map((f) => window.api.getPathForFile(f))
        void (async () => {
          try {
            const incoming =
              paths.length && paths.every(Boolean)
                ? await window.api.expandDropPaths(paths)
                : await Promise.all(
                    files
                      .filter((f) => isDroppableFile(f.name, f.type))
                      .map(async (f) => ({
                        name: f.name,
                        data: new Uint8Array(await f.arrayBuffer())
                      }))
                  )
            await extra.onOpenFiles(incoming)
          } catch {
            extra.flash('Could not open dropped files')
          }
        })()
      }}
    >
      <div className="full-backdrop" style={{ opacity: chromeOpacity }} />
      <FullViewPages
        scrollRef={s.scrollRef}
        drag={s.drag}
        draggedRef={s.draggedRef}
        docs={docs}
        viewport={s.viewport}
        di={s.di}
        pi={s.pi}
        view={s.view}
        fit={s.fit}
        vw={s.vw}
        vh={s.vh}
        zoomed={s.zoomed}
        interactive={s.interactive}
        animating={animating}
        flip={s.flip}
        flipTransition={s.flipTransition}
        renderVersion={s.renderVersion}
        marks={marks}
        hasSelection={selection.selected !== null}
        selectTool={edit.editing ? edit.tool : null}
        onMark={(pageId, rects) => {
          if (isMarkTool(edit.tool)) onToggleMark(pageId, edit.tool, rects)
        }}
        formValues={formValues}
        onFieldChange={onFieldChange}
        elements={elements}
        selectedElementId={selection.selected?.elementId ?? null}
        onSelectElement={selection.selectElement}
        onMoveElement={onMoveElement}
        onResizeImage={extra.onResizeImage}
        onDraw={onAddInk}
        onAddText={onAddText}
        onMarkText={(pageId, elementId, span) => {
          if (isMarkTool(edit.tool)) onToggleTextMark(pageId, elementId, edit.tool, span)
        }}
        onUpdateText={onUpdateText}
        setView={s.setView}
        resetView={controls.resetView}
        applyZoom={controls.applyZoom}
        runClose={controls.runClose}
      />
      {edit.editing && <div className="edit-glow" />}
      <input
        hidden
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Signature image file"
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (!file) return
          const target = replaceTarget.current
          try {
            const asset = await readImageAsset(file)
            edit.enterEdit()
            if (target) extra.onReplaceImage(s.page.id, target, asset, s.page.width, s.page.height)
            else {
              const added = extra.onAddImage(s.page.id, asset, s.page.width, s.page.height)
              if (added) selection.selectElement(s.page.id, added.id)
            }
          } catch (error) {
            extra.flash(error instanceof Error ? error.message : 'Could not open signature image.')
          }
        }}
      />
      {thumbnails && (
        <aside className="reader-thumbnails" aria-label="Page thumbnails">
          <h2>Pages</h2>
          {s.doc.pages.map((page, index) => (
            <button
              key={page.id}
              aria-label={`Go to page ${index + 1}`}
              aria-current={index === s.pi ? 'page' : undefined}
              onClick={() => controls.goToPage(index)}
            >
              <div style={{ width: 88, height: (88 * page.height) / page.width }}>
                <PageView
                  pdf={page.source.pdf}
                  pageNumber={page.pageIndex + 1}
                  naturalWidth={page.width}
                  naturalHeight={page.height}
                  version={0}
                  detail={false}
                />
              </div>
              <span>{index + 1}</span>
            </button>
          ))}
        </aside>
      )}
      {selectedImage?.kind === 'image' && (
        <section className="signature-inspector element-pill" aria-label="Signature image options">
          <strong>Signature image</strong>
          <span>Drag to move · drag the blue corner to resize</span>
          <label>
            Width{' '}
            <input
              aria-label="Signature width"
              type="range"
              min="1"
              max="90"
              value={Math.round(selectedImage.bbox.w * 100)}
              onChange={(e) =>
                extra.onResizeImage(
                  s.page.id,
                  selectedImage.id,
                  resizedImageBox(selectedImage.bbox, Number(e.target.value) / 100)
                )
              }
            />
          </label>
          <button
            className="btn glass"
            onClick={() => {
              replaceTarget.current = selectedImage.id
              imageInput.current?.click()
            }}
          >
            Replace image…
          </button>
          <button
            className="btn glass"
            onClick={() => {
              onRemoveElement(s.page.id, selectedImage.id)
              selection.selectElement(s.page.id, null)
            }}
          >
            Delete image
          </button>
        </section>
      )}
      <FullViewChrome
        documentTabs={extra.documentTabs}
        chromeOpacity={chromeOpacity}
        docIndex={s.di}
        pi={s.pi}
        pageCount={s.doc.pages.length}
        editing={edit.editing}
        tool={edit.tool}
        canRevert={edit.canRevert}
        onEnterEdit={edit.enterEdit}
        onFinishEdit={edit.finishEdit}
        onRevert={edit.revert}
        onToggleTool={(tool) => {
          if (!edit.editing) edit.enterEdit()
          edit.toggleTool(tool)
        }}
        runClose={controls.runClose}
        goToPage={controls.goToPage}
        busy={extra.busy}
        zoom={(s.fit.w / s.page.width) * s.view.zoom}
        thumbnails={thumbnails}
        onThumbnails={() => setThumbnails((v) => !v)}
        onImage={() => {
          replaceTarget.current = null
          imageInput.current?.click()
        }}
        onZoom={(direction) => controls.applyZoom((z) => z * (direction > 0 ? 1.25 : 0.8))}
        onFitPage={controls.resetView}
        onFitWidth={() => {
          setThumbnails(false)
          controls.applyZoom(() => (s.vw - 64) / s.fit.w)
          s.setView((v) => ({ ...v, y: Math.max(0, (s.fit.h * v.zoom - (s.vh - 240)) / 2) }))
        }}
        onPrint={() => extra.onPrint(s.doc.id)}
        onSave={() => extra.onSave(s.doc.id)}
        onFind={extra.onFind}
        onOpen={extra.onOpen}
        onUndo={extra.onUndo}
        onRedo={extra.onRedo}
      />
      {edit.editing && isMarkTool(edit.tool) && <ToolCursor tool={edit.tool} />}
    </div>
  )
}
