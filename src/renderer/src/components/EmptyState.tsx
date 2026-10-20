import { DashedBorder } from './dashed-border'
import { AppBrand } from './AppBrand'

interface EmptyStateProps {
  busy: boolean
  dragging?: boolean
  onOpen: () => void
}

export function EmptyState({ busy, dragging, onOpen }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="empty-state">
      <div className={'empty-card' + (dragging ? ' drag-active' : '')}>
        <DashedBorder radius={20} />
        <div className="empty-glyph" aria-hidden="true">
          <AppBrand size={80} wordmark={false} />
        </div>
        <h1>{busy ? 'Loading…' : 'XViewer'}</h1>
        <p>Drop PDFs here to organize, annotate, and search.</p>
        <button className="btn ghost" onClick={onOpen} disabled={busy}>
          Open documents…
        </button>
      </div>
    </div>
  )
}
