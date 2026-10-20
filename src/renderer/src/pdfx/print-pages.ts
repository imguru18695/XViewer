import { openPdf } from './source'

export async function renderPrintPages(
  bytes: Uint8Array
): Promise<{ png: string; width: number; height: number }[]> {
  const pdf = await openPdf(bytes)
  try {
    if (pdf.numPages > 500) throw new Error('Print up to 500 pages at a time.')
    const pages: { png: string; width: number; height: number }[] = []
    let size = 0
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index)
      const natural = page.getViewport({ scale: 1 })
      const scale = Math.min(150 / 72, 5000 / Math.max(natural.width, natural.height))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))
      await page.render({ canvas, viewport, background: 'white' }).promise
      const png = canvas.toDataURL('image/png')
      size += png.length
      canvas.width = canvas.height = 1
      if (size > 256 * 1024 * 1024)
        throw new Error('This print job is too large. Print fewer pages at a time.')
      pages.push({ png, width: natural.width, height: natural.height })
    }
    return pages
  } finally {
    await pdf.loadingTask.destroy()
  }
}
