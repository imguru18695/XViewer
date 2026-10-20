import { openPdf } from './source'

const RENDER_SCALE = 2
const INK_CHANNEL_MAX = 250

export interface PageOccupancy {
  freeSpanRight(fromX: number, yLow: number, yHigh: number): number
  contentRight: number
}

export async function buildOccupancy(bytes: Uint8Array): Promise<PageOccupancy | null> {
  const pdf = await openPdf(bytes)
  try {
    const page = await pdf.getPage(1)
    if (page.rotate % 360 !== 0) return null
    const viewport = page.getViewport({ scale: RENDER_SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, viewport }).promise
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const pageHeight = viewport.height / RENDER_SCALE

    const inkAt = (col: number, row: number): boolean => {
      if (col < 0 || col >= width || row < 0 || row >= height) return true
      const i = (row * width + col) * 4
      return (
        data[i] < INK_CHANNEL_MAX || data[i + 1] < INK_CHANNEL_MAX || data[i + 2] < INK_CHANNEL_MAX
      )
    }

    let maxInkCol = 0
    for (let row = 0; row < height; row++) {
      for (let col = width - 1; col > maxInkCol; col--) {
        if (inkAt(col, row)) {
          maxInkCol = col
          break
        }
      }
    }

    return {
      contentRight: maxInkCol / RENDER_SCALE,
      freeSpanRight(fromX, yLow, yHigh) {
        const rowStart = Math.max(0, Math.floor((pageHeight - yHigh) * RENDER_SCALE))
        const rowEnd = Math.min(height - 1, Math.ceil((pageHeight - yLow) * RENDER_SCALE))
        let col = Math.max(0, Math.ceil(fromX * RENDER_SCALE))
        for (; col < width; col++) {
          let hit = false
          for (let row = rowStart; row <= rowEnd; row++) {
            if (inkAt(col, row)) {
              hit = true
              break
            }
          }
          if (hit) break
        }
        return col / RENDER_SCALE
      }
    }
  } catch {
    return null
  } finally {
    await pdf.loadingTask.destroy().catch(() => undefined)
  }
}
