import { useEffect, useRef, useState } from 'react'
import type { ImageElement, ElementRect } from '../../elements/types'
import { resizedImageBox } from '../../elements/image'

interface Props {
  element: ImageElement
  width: number
  height: number
  interactive: boolean
  selected: boolean
  hovered: boolean
  zoomScale: number
  offset: { dx: number; dy: number } | null
  onHover: (id: string | null) => void
  onDragStart: (id: string, x: number, y: number) => void
  onResize?: (id: string, box: ElementRect) => void
}

export function ElementImage({
  element,
  width,
  height,
  interactive,
  selected,
  hovered,
  zoomScale,
  offset,
  onHover,
  onDragStart,
  onResize
}: Props): React.JSX.Element {
  const [preview, setPreview] = useState<ElementRect | null>(null)
  const drag = useRef<{ x: number; width: number; box: ElementRect } | null>(null)
  const previewRef = useRef(preview)
  previewRef.current = preview
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (drag.current)
        setPreview(
          resizedImageBox(
            drag.current.box,
            drag.current.box.w + (event.clientX - drag.current.x) / drag.current.width
          )
        )
    }
    const end = () => {
      if (drag.current && previewRef.current) onResize?.(element.id, previewRef.current)
      drag.current = null
      setPreview(null)
    }
    const cancel = () => {
      drag.current = null
      setPreview(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [element.id, onResize])
  const b = preview ?? element.bbox
  const x = b.x * width,
    y = b.y * height,
    w = b.w * width,
    h = b.h * height
  return (
    <g
      data-image-id={element.id}
      transform={offset ? `translate(${offset.dx * width} ${offset.dy * height})` : undefined}
    >
      <image
        href={element.asset.dataUrl}
        x={x}
        y={y}
        width={w}
        height={h}
        preserveAspectRatio="none"
      />
      {interactive && (
        <rect
          className="element-hit signature-hit"
          x={x}
          y={y}
          width={w}
          height={h}
          fill="transparent"
          stroke={selected || hovered ? '#4483f7' : 'transparent'}
          strokeWidth={1.5 / zoomScale}
          style={{ cursor: 'move' }}
          onPointerEnter={() => onHover(element.id)}
          onPointerLeave={() => onHover(null)}
          onPointerDown={(e) => {
            e.stopPropagation()
            onDragStart(element.id, e.clientX, e.clientY)
          }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      )}
      {interactive && selected && onResize && (
        <rect
          className="element-hit signature-resize"
          aria-label="Resize signature"
          x={x + w - 6 / zoomScale}
          y={y + h - 6 / zoomScale}
          width={12 / zoomScale}
          height={12 / zoomScale}
          fill="#4483f7"
          style={{ cursor: 'nwse-resize' }}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            const bounds = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
            if (bounds?.width)
              drag.current = { x: e.clientX, width: bounds.width, box: element.bbox }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </g>
  )
}
