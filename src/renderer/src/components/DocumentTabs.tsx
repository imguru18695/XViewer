import { useEffect, useRef } from 'react'
import type { DocEntry } from '../types'

export function DocumentTabs({
  docs,
  activeId,
  onSelect,
  onClose
}: {
  docs: DocEntry[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
}): React.JSX.Element {
  const active = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    if (document.activeElement === document.body) active.current?.focus({ preventScroll: true })
  }, [activeId])
  return (
    <div className="document-tabs" role="tablist" aria-label="Open PDFs">
      {docs.map((doc, index) => (
        <div className={`document-tab${doc.id === activeId ? ' active' : ''}`} key={doc.id}>
          <button
            ref={doc.id === activeId ? active : undefined}
            role="tab"
            aria-selected={doc.id === activeId}
            tabIndex={doc.id === activeId ? 0 : -1}
            title={doc.name}
            onClick={() => onSelect(doc.id)}
            onKeyDown={(e) => {
              let next = index
              if (e.key === 'ArrowRight') next = (index + 1) % docs.length
              else if (e.key === 'ArrowLeft') next = (index + docs.length - 1) % docs.length
              else if (e.key === 'Home') next = 0
              else if (e.key === 'End') next = docs.length - 1
              else return
              e.preventDefault()
              e.stopPropagation()
              onSelect(docs[next].id)
              const tabs = e.currentTarget
                .closest('[role=tablist]')
                ?.querySelectorAll<HTMLButtonElement>('[role=tab]')
              tabs?.[next]?.focus()
            }}
          >
            {doc.name}
          </button>
          <button
            className="close-tab"
            aria-label={`Close ${doc.name}`}
            title="Close PDF (Ctrl+W)"
            onClick={() => onClose(doc.id)}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
