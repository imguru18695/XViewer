import { useEffect } from 'react'
import { ARROW_PAN, clamp, WHEEL_ZOOM_SPEED, ZOOM_STEP } from './geometry'
import type { FullViewControls } from './use-full-view-controls'

interface InputOptions extends FullViewControls {
  scrollRef: React.RefObject<HTMLDivElement | null>
  zoomedRef: React.MutableRefObject<boolean>
  phaseRef: React.MutableRefObject<'opening' | 'open' | 'closing'>
  editingRef: React.MutableRefObject<boolean>
  finishEdit: () => void
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
}

export function useFullViewInput(opts: InputOptions): void {
  const { scrollRef, zoomedRef, phaseRef, editingRef, finishEdit } = opts
  const { resetView, applyZoom, panBy, navByKey, runClose, goToPage } = opts

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return
      if (event.key === 'Escape') {
        if (editingRef.current) finishEdit()
        else runClose()
        return
      }
      if (phaseRef.current !== 'open') return
      if (
        event.key === 'PageDown' ||
        event.key === 'PageUp' ||
        event.key === 'Home' ||
        event.key === 'End'
      ) {
        event.preventDefault()
        if (event.key === 'Home') goToPage(0)
        else if (event.key === 'End') goToPage(Number.MAX_SAFE_INTEGER)
        else navByKey('x', event.key === 'PageDown' ? 1 : -1)
        return
      }
      if (zoomedRef.current) {
        if (event.key === 'ArrowLeft') panBy(ARROW_PAN, 0)
        else if (event.key === 'ArrowRight') panBy(-ARROW_PAN, 0)
        else if (event.key === 'ArrowUp') panBy(0, ARROW_PAN)
        else if (event.key === 'ArrowDown') panBy(0, -ARROW_PAN)
        else return
        event.preventDefault()
        return
      }
      if (event.key === 'ArrowRight') navByKey('x', 1)
      else if (event.key === 'ArrowLeft') navByKey('x', -1)
      else if (event.key === 'ArrowDown') navByKey('x', 1)
      else if (event.key === 'ArrowUp') navByKey('x', -1)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runClose, navByKey, panBy, finishEdit, goToPage])

  useEffect(() => {
    return window.api.onZoom((action) => {
      if (phaseRef.current !== 'open') return
      if (action === 'in') applyZoom((z) => z * ZOOM_STEP)
      else if (action === 'out') applyZoom((z) => z / ZOOM_STEP)
      else resetView()
    })
  }, [applyZoom, resetView])

  useEffect(() => {
    const sc = scrollRef.current
    if (!sc) return
    let lastPageWheel = 0
    const onWheel = (event: WheelEvent): void => {
      if (phaseRef.current !== 'open') {
        event.preventDefault()
        return
      }
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        const dy = clamp(event.deltaY, -50, 50)
        applyZoom((z) => z * Math.pow(2, -dy * WHEEL_ZOOM_SPEED), {
          x: event.clientX,
          y: event.clientY
        })
        return
      }
      if (zoomedRef.current) {
        event.preventDefault()
        panBy(-event.deltaX, -event.deltaY)
        return
      }
      if (editingRef.current && Math.abs(event.deltaY) >= Math.abs(event.deltaX)) {
        event.preventDefault()
        panBy(0, -event.deltaY)
      } else if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault()
        if (Math.abs(event.deltaY) >= 5 && Date.now() - lastPageWheel > 220) {
          lastPageWheel = Date.now()
          navByKey('x', event.deltaY > 0 ? 1 : -1)
        }
      }
    }
    sc.addEventListener('wheel', onWheel, { passive: false })
    return () => sc.removeEventListener('wheel', onWheel)
  }, [applyZoom, panBy, navByKey])
}
