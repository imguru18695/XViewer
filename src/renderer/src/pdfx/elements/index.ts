import { degrees } from 'pdf-lib'
import type { PDFPage } from 'pdf-lib'
import { normalizeRotation, visualPointToUser } from '../redact/geometry'
import type { PageElement } from '../../elements/types'
import { drawInkElements } from './ink'
import { drawTextElement } from './text'
import { fontForElement } from './fonts'
import type { ElementFonts } from './fonts'

export async function drawElements(
  page: PDFPage,
  elements: PageElement[] | undefined,
  fonts?: ElementFonts
): Promise<void> {
  if (!elements || elements.length === 0) return
  for (const element of elements) {
    if (element.kind === 'ink') drawInkElements(page, [element])
    else if (element.kind === 'text' && fonts)
      drawTextElement(page, element, fontForElement(element, fonts))
    else if (element.kind === 'image') {
      const image = await page.doc.embedPng(element.asset.dataUrl)
      const box = page.getCropBox()
      const rot = normalizeRotation(page.getRotation().angle)
      const sideways = rot === 90 || rot === 270
      const vw = sideways ? box.height : box.width,
        vh = sideways ? box.width : box.height
      const p = visualPointToUser(element.bbox.x, element.bbox.y + element.bbox.h, box, rot)
      page.drawImage(image, {
        x: p.x,
        y: p.y,
        width: element.bbox.w * vw,
        height: element.bbox.h * vh,
        rotate: degrees(rot)
      })
    }
  }
}

export const hasTextElements = (elements: PageElement[] | undefined): boolean =>
  !!elements && elements.some((e) => e.kind === 'text')
