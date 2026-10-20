import type { MarkKind } from '../../edit/types'
import type { PageElement, TextElement, ElementRect } from '../../elements/types'
import { ElementImage } from './ElementImage'
import type { TextSpan } from '../../elements/text-marks'
import { ElementPath } from './ElementPath'
import { ElementText } from './ElementText'

interface ElementNodeProps {
  element: PageElement
  width: number
  height: number
  interactive: boolean
  markTool: MarkKind | null
  preview: TextSpan | null
  hovered: boolean
  selected: boolean
  zoomScale: number
  offset: { dx: number; dy: number } | null
  onHover: (id: string | null) => void
  onDragStart: (id: string, clientX: number, clientY: number) => void
  onMarkDragStart: (element: TextElement, clientX: number, clientY: number, detail: number) => void
  onEdit: (id: string) => void
  onResize?: (id: string, box: ElementRect) => void
}

export function ElementNode({
  element,
  markTool,
  preview,
  onMarkDragStart,
  onEdit,
  onResize,
  ...shared
}: ElementNodeProps): React.JSX.Element {
  if (element.kind === 'image')
    return <ElementImage element={element} onResize={onResize} {...shared} />
  return element.kind === 'ink' ? (
    <ElementPath element={element} {...shared} />
  ) : (
    <ElementText
      element={element}
      markTool={markTool}
      preview={preview}
      onMarkDragStart={onMarkDragStart}
      onEdit={onEdit}
      {...shared}
    />
  )
}
