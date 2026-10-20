import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib'
import { readContent } from '../src/renderer/src/pdfx/redact/page-content'
import { buildPdf, buildPdfx } from '../src/renderer/src/pdfx/build'
import { fillFormValues } from '../src/renderer/src/forms/fill'
import { buildRedactedSourcePage } from '../src/renderer/src/pdfx/redact'
import type { PageEntry } from '../src/renderer/src/types'
import { createImageElement, resizedImageBox } from '../src/renderer/src/elements/image'
import { translateElement } from '../src/renderer/src/elements/geometry'
import { applyElementEntry } from '../src/renderer/src/elements/apply-entry'
import { degrees, PDFDict } from 'pdf-lib'

async function fixture() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  // Explicit widths exercise the supported content-stream path; base-14 fonts
  // without widths deliberately use the raster fallback.
  doc.addPage([600, 800]).drawText('SECRET', { x: 50, y: 700, size: 20, font })
  doc.getPage(0).drawText('PUBLIC', { x: 50, y: 600, size: 20, font })
  doc.addPage([400, 500])
  await doc.flush()
  const fontDict = doc.context.lookup(font.ref) as import('pdf-lib').PDFDict
  fontDict.set(PDFName.of('FirstChar'), doc.context.obj(32))
  fontDict.set(
    PDFName.of('Widths'),
    doc.context.obj(
      Array.from({ length: 95 }, (_, i) =>
        font.widthOfTextAtSize(String.fromCharCode(i + 32), 1000)
      )
    )
  )
  return doc.save()
}

test('plain PDF preserves requested page order and omits collection names', async () => {
  const bytes = await fixture()
  const output = await PDFDocument.load(
    await buildPdf(
      [1, 0].map((pageIndex) => ({
        kind: 'source' as const,
        sourceKey: 'source',
        bytes,
        pageIndex
      }))
    )
  )
  assert.deepEqual(
    output.getPages().map((page) => page.getWidth()),
    [400, 600]
  )
  assert.equal(output.catalog.has(PDFName.of('Names')), false)
})

test('collection export intentionally includes its document manifest', async () => {
  const bytes = await fixture()
  const output = await PDFDocument.load(
    await buildPdfx(
      [{ name: 'Example', pages: [{ kind: 'source', bytes, sourceKey: 'source', pageIndex: 0 }] }],
      'Collection'
    )
  )
  assert.equal(output.getPageCount(), 1)
  assert.equal(output.catalog.has(PDFName.of('Names')), true)
})

test('form values survive export as flattened appearances', async () => {
  const doc = await PDFDocument.create()
  const page = doc.addPage()
  const field = doc.getForm().createTextField('name')
  field.addToPage(page, { x: 20, y: 20, width: 200, height: 30 })
  const output = await PDFDocument.load(await fillFormValues(await doc.save(), { name: 'Ada' }))
  assert.equal(output.getForm().getFields().length, 0)
  assert.ok(output.getPage(0).node.Contents())
})

test('invalid form field aborts instead of silently exporting unfilled data', async () => {
  await assert.rejects(fillFormValues(await fixture(), { missing: 'Ada' }), /Export canceled/)
})

test('redaction removes selected glyphs while retaining unrelated text', async () => {
  const bytes = await fixture()
  const entry = {
    id: 'p1',
    pageIndex: 0,
    width: 600,
    height: 800,
    source: { id: 'source', bytes }
  } as PageEntry
  const redacted = await buildRedactedSourcePage(entry, [
    {
      id: 'm1',
      kind: 'redact',
      color: 'black',
      rects: [{ x: 45 / 600, y: 75 / 800, w: 110 / 600, h: 35 / 800 }]
    }
  ])
  assert.ok(redacted, 'simple Helvetica content should use content removal')
  const output = await PDFDocument.load(redacted.bytes)
  const decoded = Buffer.from(readContent(output.context, output.getPage(0))!).toString('latin1')
  assert.equal(decoded.includes(Buffer.from('SECRET').toString('hex').toUpperCase()), false)
  assert.ok(decoded.includes(Buffer.from('PUBLIC').toString('hex').toUpperCase()))
})

const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='

test('signature images keep their aspect ratio and remain on the page when resized', () => {
  for (const [width, height] of [
    [1, 10000],
    [10000, 1]
  ]) {
    const extreme = createImageElement(
      { dataUrl: png, name: 'image.png', width, height },
      1,
      600,
      800
    )
    const resized = resizedImageBox(extreme.bbox, 2)
    assert.ok(resized.x + resized.w <= 1 + 1e-10)
    assert.ok(resized.y + resized.h <= 1 + 1e-10)
  }
  const image = createImageElement(
    { dataUrl: png, name: 'signature.png', width: 400, height: 100 },
    1,
    600,
    800
  )
  const box = resizedImageBox(image.bbox, 2)
  assert.ok(box.x + box.w <= 1)
  assert.ok(box.y + box.h <= 1)
  assert.equal(box.w / box.h, image.bbox.w / image.bbox.h)
  const moved = translateElement(image, 0.05, 0.1)
  assert.equal(moved.bbox.x, image.bbox.x + 0.05)
  const entry = {
    action: 'element' as const,
    value: 'edit' as const,
    payload: { pageId: 'p', before: image, after: moved }
  }
  assert.deepEqual(applyElementEntry([moved], entry, 'undo'), [image])
  assert.deepEqual(applyElementEntry([image], entry, 'redo'), [moved])
})

test('signature images are embedded in exports including rotated source pages', async () => {
  for (const angle of [0, 90, 180, 270]) {
    const doc = await PDFDocument.create()
    doc.addPage([600, 800]).setRotation(degrees(angle))
    const element = createImageElement(
      { dataUrl: png, name: 'signature.png', width: 400, height: 100 },
      1,
      angle % 180 ? 800 : 600,
      angle % 180 ? 600 : 800
    )
    const output = await PDFDocument.load(
      await buildPdf([
        {
          kind: 'source',
          bytes: await doc.save(),
          sourceKey: 'sig',
          pageIndex: 0,
          elements: [element]
        }
      ])
    )
    const objects = output.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict)
    assert.equal(objects.keys().length, 1)
    assert.equal(output.getPage(0).getRotation().angle, angle)
  }
})
