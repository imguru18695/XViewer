import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib'
import { readContent } from '../src/renderer/src/pdfx/redact/page-content'
import { buildPdf, buildPdfx } from '../src/renderer/src/pdfx/build'
import { fillFormValues } from '../src/renderer/src/forms/fill'
import { buildRedactedSourcePage } from '../src/renderer/src/pdfx/redact'
import type { PageEntry } from '../src/renderer/src/types'

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
