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
const processLogs = []
app.process().stderr?.on('data', (data) => processLogs.push(data.toString()))
app.process().on('exit', (code, signal) => console.log('Electron exit:', code, signal))
try {
  const page = await app.firstWindow()
  await page.emulateMedia({ colorScheme: 'dark' })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('crash', () => console.log('Renderer crashed'))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') console.log(message.text())
  })
  await page.locator('.full-view[data-phase="open"]').waitFor({ timeout: 30000 })
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.full-page canvas')].some((c) => c.width > 100)
  )
  await page.screenshot({ path: 'docs/screenshots/workspace.png' })
  console.log('Opened PDF and captured workspace')
  const atPage = async (number) =>
    page.waitForFunction(
      (n) => document.querySelector('input[aria-label="Page number"]')?.value === String(n),
      number
    )
  await page.keyboard.press('PageDown')
  await atPage(2)
  await page.keyboard.press('PageUp')
  await atPage(1)
  await page.getByRole('button', { name: 'Fit Width', exact: true }).click()
  await page.keyboard.press('End')
  await atPage(2)
  await page.keyboard.press('Home')
  await atPage(1)
  await page.getByRole('button', { name: 'Fit Page', exact: true }).click()
  await page.getByLabel('Page number', { exact: true }).fill('2')
  await page.getByLabel('Page number', { exact: true }).press('Enter')
  await atPage(2)
  if (await page.locator('.reader-thumbnails').count())
    await page.getByRole('button', { name: 'Thumbnails', exact: true }).click()
  await page.locator('.reader-thumbnails').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Thumbnails', exact: true }).click()
  await page.getByRole('button', { name: 'Go to page 1', exact: true }).click()
  await atPage(1)
  console.log('PASS: page keys, page-number entry, fit controls, thumbnails')
  const selectedText = page
    .locator('.full-doc')
    .first()
    .locator('.edit-select-layer.select span')
    .filter({ hasText: 'Local PDF tools on your desktop.' })
  await selectedText.waitFor()
  await selectedText.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  })
  assert.equal(
    await page.evaluate(() => window.getSelection().toString()),
    'Local PDF tools on your desktop.'
  )
  await page.evaluate(() => window.getSelection().removeAllRanges())
  await page.keyboard.press('Control+f')
  await page.getByPlaceholder('Search', { exact: true }).fill('workflow')
  await page.waitForFunction(
    () => document.querySelector('.findbar-count')?.textContent === '1 page'
  )
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Redact', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Add Text', exact: true }).waitFor()
  await page.screenshot({ path: 'docs/screenshots/editor.png' })
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  const signature = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 120
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#15395c'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(20, 90)
    ctx.bezierCurveTo(100, -50, 30, 150, 160, 40)
    ctx.bezierCurveTo(170, 110, 260, 0, 280, 65)
    ctx.lineTo(380, 55)
    ctx.stroke()
    return canvas.toDataURL('image/png').split(',')[1]
  })
  const signaturePath = resolve('.smoke/signature.png')
  await writeFile(signaturePath, Buffer.from(signature, 'base64'))
  await page.locator('.signature-menu summary').click()
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Choose signature image…', exact: true }).click()
  ])
  await chooser.setFiles(signaturePath)
  await page.getByRole('region', { name: 'Signature image options' }).waitFor()
  const hit = page.locator('.full-view .signature-hit')
  const before = await hit.boundingBox()
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2 + 45, before.y + before.height / 2 + 80, {
    steps: 12
  })
  await page.mouse.up()
  await page.waitForFunction(
    (x) => document.querySelector('.full-view .signature-hit')?.getBoundingClientRect().x > x + 20,
    before.x
  )
  const corner = await page.locator('.full-view .signature-resize').boundingBox()
  const originalWidth = (await hit.boundingBox()).width
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2)
  await page.mouse.down()
  await page.mouse.move(corner.x + corner.width / 2 + 35, corner.y + corner.height / 2 + 10, {
    steps: 10
  })
  await page.mouse.up()
  await page.waitForFunction(
    (w) =>
      document.querySelector('.full-view .signature-hit')?.getBoundingClientRect().width > w + 10,
    originalWidth
  )
  const [replaceChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Replace image…', exact: true }).click()
  ])
  await replaceChooser.setFiles(signaturePath)
  await page.getByRole('button', { name: 'Delete image', exact: true }).click()
  await page.locator('.full-view .signature-hit').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.locator('.full-view .signature-hit').waitFor()
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await page.locator('.full-view .signature-hit').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.locator('.full-view .signature-hit').waitFor()
  await page.locator('.full-view .signature-hit').click()
  await page.getByRole('region', { name: 'Signature image options' }).waitFor()
  await page.screenshot({ path: 'docs/screenshots/signature.png' })
  console.log('PASS: navigation, selection, signature import/move/resize/replace/delete/undo/redo')
  // Exercise the real print pipeline while replacing only the native printer
  // dialog; no physical print job is submitted by this test.
  await app.evaluate(({ app }) => {
    app.on('browser-window-created', (_event, win) => {
      if (win.getTitle() !== 'XViewer Print') return
      win.webContents.print = (options, callback) => {
        globalThis.__printOptions = options
        if (globalThis.__cancelPrint) {
          callback(false, 'cancelled')
          return
        }
        win.webContents
          .printToPDF({ printBackground: true, preferCSSPageSize: true })
          .then((bytes) => {
            globalThis.__printPdf = Array.from(bytes)
            callback(true, '')
          })
          .catch((error) => callback(false, error.message))
      }
    })
  })
  await page.locator('.full-view').getByRole('button', { name: 'Print', exact: true }).click()
  let printed
  for (let i = 0; i < 100; i++) {
    printed = await app.evaluate(() => globalThis.__printPdf)
    if (printed) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.ok(printed, 'native print pipeline should receive document pages')
  const printedDoc = await PDFDocument.load(Uint8Array.from(printed))
  assert.equal(printedDoc.getPageCount(), 2)
  assert.equal(await app.evaluate(() => globalThis.__printOptions.silent), false)
  await app.evaluate(() => {
    globalThis.__cancelPrint = true
  })
  await page.locator('.full-view').getByRole('button', { name: 'Print', exact: true }).click()
  await page.getByText('Printing canceled', { exact: true }).waitFor()
  await app.evaluate(() => {
    globalThis.__cancelPrint = false
  })
  await page.getByRole('button', { name: 'Save a Copy', exact: true }).waitFor({ state: 'visible' })
  console.log('PASS: print pipeline and native-dialog options (physical printing mocked)')
  const signedPath = resolve(`.smoke/signed-${process.pid}.pdf`)
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
  }, signedPath)
  await page.getByRole('button', { name: 'Save a Copy', exact: true }).click()
  let signed
  for (let i = 0; i < 100; i++) {
    try {
      signed = await PDFDocument.load(await readFile(signedPath))
      break
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.ok(
    signed?.getPage(0).node.Resources().has(PDFName.of('XObject')),
    'saved PDF must embed signature image'
  )
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.setViewportSize({ width: 800, height: 760 })
  await page.screenshot({ path: '.smoke/reader-narrow.png' })
  await page.setViewportSize({ width: 1320, height: 860 })
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
  await page.getByLabel('Document', { exact: true }).selectOption('0')
  await page.getByRole('button', { name: 'Close (Esc)', exact: true }).click()
  await page.locator('.full-view').waitFor({ state: 'detached' })
  console.log('Closed reader after OCR; reopening first page')
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
} catch (error) {
  console.log(processLogs.slice(-12).join('\n'))
  const window = app.windows()[0]
  if (window && !window.isClosed())
    await window.screenshot({ path: '.smoke/failure.png' }).catch(() => {})
  throw error
} finally {
  await app.close()
}
