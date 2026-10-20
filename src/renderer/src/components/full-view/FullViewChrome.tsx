import { useEffect, useState } from 'react'
import { CloseIcon } from '../icons'
import { AppBrand } from '../AppBrand'
import type { EditTool } from '../../edit/types'

interface Props {
  chromeOpacity: number
  docName: string
  docNames: string[]
  docIndex: number
  pi: number
  pageCount: number
  editing: boolean
  tool: EditTool | null
  canRevert: boolean
  busy: boolean
  zoom: number
  thumbnails: boolean
  onEnterEdit: () => void
  onFinishEdit: () => void
  onRevert: () => void
  onToggleTool: (tool: EditTool) => void
  runClose: () => void
  goToPage: (index: number) => void
  goToDocument: (index: number) => void
  onZoom: (direction: -1 | 1) => void
  onFitPage: () => void
  onFitWidth: () => void
  onThumbnails: () => void
  onImage: () => void
  onPrint: () => void
  onSave: () => void
  onFind: () => void
  onOpen: () => void
  onUndo: () => void
  onRedo: () => void
}

export function FullViewChrome(p: Props): React.JSX.Element {
  const [page, setPage] = useState(String(p.pi + 1))
  useEffect(() => setPage(String(p.pi + 1)), [p.pi, p.docIndex])
  const commitPage = () => {
    const value = Number(page)
    if (Number.isInteger(value) && value >= 1 && value <= p.pageCount) p.goToPage(value - 1)
    else setPage(String(p.pi + 1))
  }
  return (
    <div className="full-chrome" style={{ opacity: p.chromeOpacity }}>
      <header className="full-bar reader-header">
        <AppBrand className="reader-brand" />
        <button className="btn glass" onClick={p.onOpen} disabled={p.busy}>
          Open
        </button>
        <select
          aria-label="Document"
          value={p.docIndex}
          onChange={(e) => p.goToDocument(Number(e.target.value))}
        >
          {p.docNames.map((name, index) => (
            <option key={index} value={index}>
              {name}
            </option>
          ))}
        </select>
        <div className="toolbar-spacer" />
        <button className="btn glass" onClick={p.onFind} title="Find text (Ctrl+F)">
          Find
        </button>
        <button
          className="btn glass"
          onClick={p.onSave}
          disabled={p.busy}
          title="Save a copy (Ctrl+S)"
        >
          Save a Copy
        </button>
        <button className="btn glass" onClick={p.onPrint} disabled={p.busy} title="Print (Ctrl+P)">
          Print
        </button>
        <button className="btn glass" onClick={p.runClose}>
          Organize pages
        </button>
        <button className="btn glass square" title="Close (Esc)" onClick={p.runClose}>
          <CloseIcon size={16} />
        </button>
      </header>
      <div className="reader-tools" role="toolbar" aria-label="PDF tools">
        <button className="btn glass" aria-pressed={p.thumbnails} onClick={p.onThumbnails}>
          Thumbnails
        </button>
        {!p.editing && (
          <button className="btn glass" onClick={p.onEnterEdit}>
            Edit
          </button>
        )}
        <details className="signature-menu">
          <summary className="btn glass">Sign ▾</summary>
          <div className="signature-options">
            <button
              className="btn glass"
              onClick={(e) => {
                e.currentTarget.closest('details')?.removeAttribute('open')
                p.onToggleTool('draw')
              }}
            >
              Draw signature
            </button>
            <button
              className="btn glass"
              onClick={(e) => {
                e.currentTarget.closest('details')?.removeAttribute('open')
                p.onImage()
              }}
            >
              Choose signature image…
            </button>
          </div>
        </details>
        <button
          className={`btn glass${p.tool === 'text' ? ' on' : ''}`}
          aria-pressed={p.tool === 'text'}
          onClick={() => p.onToggleTool('text')}
        >
          Add Text
        </button>
        <button
          className={`btn glass${p.tool === 'highlight' ? ' on' : ''}`}
          aria-pressed={p.tool === 'highlight'}
          onClick={() => p.onToggleTool('highlight')}
        >
          Highlight
        </button>
        <button
          className={`btn glass${p.tool === 'redact' ? ' on' : ''}`}
          aria-pressed={p.tool === 'redact'}
          onClick={() => p.onToggleTool('redact')}
        >
          Redact
        </button>
        <span className="tool-divider" />
        <button className="btn glass" onClick={p.onUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button className="btn glass" onClick={p.onRedo} title="Redo (Ctrl+Y)">
          Redo
        </button>
        {p.editing && (
          <>
            <button className="btn glass" disabled={!p.canRevert} onClick={p.onRevert}>
              Revert
            </button>
            <button className="btn yellow" onClick={p.onFinishEdit}>
              Done
            </button>
          </>
        )}
      </div>
      <footer className="reader-status">
        <div className="reader-pagination" role="group" aria-label="Page navigation">
          <button
            className="btn glass"
            title="First page (Home)"
            disabled={p.pi === 0}
            onClick={() => p.goToPage(0)}
          >
            First
          </button>
          <button
            className="btn glass"
            title="Previous page (Page Up)"
            disabled={p.pi === 0}
            onClick={() => p.goToPage(p.pi - 1)}
          >
            Previous
          </button>
          <label>
            Page{' '}
            <input
              aria-label="Page number"
              inputMode="numeric"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              onBlur={commitPage}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitPage()
                  e.currentTarget.blur()
                }
              }}
            />
          </label>
          <span className="reader-page-count" aria-live="polite">
            of {p.pageCount}
          </span>
          <button
            className="btn glass"
            title="Next page (Page Down)"
            disabled={p.pi === p.pageCount - 1}
            onClick={() => p.goToPage(p.pi + 1)}
          >
            Next
          </button>
          <button
            className="btn glass"
            title="Last page (End)"
            disabled={p.pi === p.pageCount - 1}
            onClick={() => p.goToPage(p.pageCount - 1)}
          >
            Last
          </button>
        </div>
        <div className="reader-zoom" role="group" aria-label="Page zoom">
          <button className="btn glass" title="Zoom out" onClick={() => p.onZoom(-1)}>
            −
          </button>
          <span aria-label="Zoom level">{Math.round(p.zoom * 100)}%</span>
          <button className="btn glass" title="Zoom in" onClick={() => p.onZoom(1)}>
            +
          </button>
          <button className="btn glass" onClick={p.onFitPage}>
            Fit Page
          </button>
          <button className="btn glass" onClick={p.onFitWidth}>
            Fit Width
          </button>
        </div>
      </footer>
    </div>
  )
}
