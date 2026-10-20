import { _electron as electron } from 'playwright'
import { PDFDocument, PDFName, StandardFonts, rgb } from 'pdf-lib'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

await mkdir('.smoke', { recursive: true })
await mkdir('docs/screenshots', { recursive: true })
const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.Helvetica)
for (const [heading, lines] of [
  [
    'XViewer | Your PDF workspace',
    [
      'View. Organize. Annotate.',
      'Local PDF tools on your desktop.',
      'Search this document with Ctrl+F.'
    ]
  ],
  [
    'A focused desktop workflow',
    [
      'Open PDF documents from Windows.',
      'Add text, highlights, and drawings.',
      'Export a new PDF when you are ready.'
    ]
  ]
]) {
  const p = doc.addPage([612, 792])
  p.drawRectangle({ x: 0, y: 650, width: 612, height: 142, color: rgb(0.08, 0.15, 0.24) })
  p.drawText(heading, { x: 36, y: 705, size: 24, font, color: rgb(1, 1, 1) })
  lines.forEach((line, i) => p.drawText(line, { x: 36, y: 590 - i * 44, size: 19, font }))
}
const sample = resolve('.smoke/Welcome to XViewer.pdf')
await writeFile(sample, await doc.save())
const env = { ...process.env, PDFX_USER_DATA: resolve('.smoke/user-data') }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({
  ...(process.env.XVIEWER_EXECUTABLE
    ? { executablePath: resolve(process.env.XVIEWER_EXECUTABLE) }
    : {}),
  args: process.env.XVIEWER_EXECUTABLE ? [sample] : [resolve('.'), sample],
  env,
  timeout: 30000
})
try {
  const page = await app.firstWindow()
  await page.emulateMedia({ colorScheme: 'dark' })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') console.log(message.text())
  })
  await page.locator('[data-page-id]').first().waitFor({ timeout: 30000 })
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.page canvas')].some((c) => c.width > 100)
  )
  await page.screenshot({ path: 'docs/screenshots/workspace.png' })
  console.log('Opened PDF and captured workspace')
  await page.keyboard.press('Control+f')
  await page.getByPlaceholder('Search', { exact: true }).fill('workflow')
  await page.waitForFunction(
    () => document.querySelector('.findbar-count')?.textContent === '1 page'
  )
  await page.keyboard.press('Escape')
  await page.locator('[data-page-id]').first().dblclick()
  await page.locator('.full-view[data-phase="open"]').waitFor()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Redact', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Add Text', exact: true }).waitFor()
  await page.screenshot({ path: 'docs/screenshots/editor.png' })
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Close (Esc)', exact: true }).click()
  await page.locator('.full-view').waitFor({ state: 'detached' })
  // Build an image-only PDF to exercise the real local OCR worker.
  console.log('Checked search and editor; preparing OCR fixture')
  const png = Buffer.from(
    await page
      .locator('.page canvas')
      .first()
      .evaluate((canvas) => canvas.toDataURL('image/png').split(',')[1]),
    'base64'
  )
  const scan = await PDFDocument.create()
  const image = await scan.embedPng(png)
  scan.addPage([612, 792]).drawImage(image, { x: 0, y: 0, width: 612, height: 792 })
  const scanPath = resolve('.smoke/Scanned sample.pdf')
  const scanBytes = await scan.save()
  await writeFile(scanPath, scanBytes)
  console.log('Sending scanned PDF to renderer')
  await page.route('https://**/*', (route) => route.abort())
  await app.evaluate(
    ({ BrowserWindow }, { path, bytes }) => {
      BrowserWindow.getAllWindows()[0].webContents.send('pdfx:files-opened', [
        { name: 'Scanned sample.pdf', data: new Uint8Array(bytes), path }
      ])
    },
    { path: scanPath, bytes: Array.from(scanBytes) }
  )
  await page.keyboard.press('Control+f')
  console.log('Waiting for scanned-page OCR search')
  await page.getByPlaceholder('Search', { exact: true }).fill('workspace')
  await page.waitForFunction(
    () => document.querySelector('.findbar-count')?.textContent === '2 pages',
    undefined,
    { timeout: 60000 }
  )
  await page.getByPlaceholder('Search', { exact: true }).fill('')
  await page.keyboard.press('Escape')
  await page.locator('[data-page-id]').first().dblclick()
  await page.locator('.full-view[data-phase="open"]').waitFor()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Redact', exact: true }).click()
  const target = page
    .locator('.edit-select-layer span')
    .filter({ hasText: 'Local PDF tools on your desktop.' })
  await target.waitFor()
  await target.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    window.dispatchEvent(new PointerEvent('pointerup'))
  })
  await page.locator('.full-view .mark-rect.redact').first().waitFor()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Close (Esc)', exact: true }).click()
  await page.locator('.full-view').waitFor({ state: 'detached' })
  const outputPath = resolve(`.smoke/redacted-export-${process.pid}.pdf`)
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
  }, outputPath)
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click()
  let exported
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      exported = await PDFDocument.load(await readFile(outputPath))
      break
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.ok(exported, 'redacted PDF should be saved')
  // Base-14 fonts without widths deliberately use raster redaction. The saved
  // first page must contain an image rather than recoverable source glyphs.
  const resources = exported.getPage(0).node.Resources()
  const fonts = resources.lookupMaybe(PDFName.of('Font'), (await import('pdf-lib')).PDFDict)
  assert.equal(fonts?.keys().length ?? 0, 0)
  assert.ok(resources.has(PDFName.of('XObject')))
  assert.equal(exported.getPageCount(), 3)
  assert.deepEqual(errors, [])
  console.log(
    'PASS: startup PDF opening, search, editor, offline OCR, redaction export, screenshots'
  )
} finally {
  await app.close()
}
