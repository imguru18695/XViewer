import { _electron as electron } from 'playwright'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

await mkdir('.smoke', { recursive: true })
const files = []
for (const title of ['Project brief', 'Design reference', 'Meeting notes']) {
  const name = `${title}.pdf`
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= 3; i++)
    doc.addPage().drawText(`${name} - Page ${i}`, { x: 45, y: 700, font, size: 24 })
  const path = resolve('.smoke', name)
  await writeFile(path, await doc.save())
  files.push(path)
}
const env = { ...process.env, PDFX_USER_DATA: resolve('.smoke/tabs-user-data') }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({
  ...(process.env.XVIEWER_EXECUTABLE
    ? { executablePath: resolve(process.env.XVIEWER_EXECUTABLE) }
    : {}),
  args: process.env.XVIEWER_EXECUTABLE ? files.slice(0, 2) : [resolve('.'), ...files.slice(0, 2)],
  env
})
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.emulateMedia({ colorScheme: 'dark' })
  const tab = (name) => page.getByRole('tab', { name, exact: true })
  const current = async (name, number) => {
    console.log('Checking', name, number)
    await page.locator('.full-view[data-phase="open"]').waitFor()
    await page.waitForFunction(
      ({ name, number }) =>
        document.querySelector('[role=tab][aria-selected=true]')?.textContent === name &&
        document.querySelector('[aria-label="Page number"]')?.value === String(number),
      { name, number }
    )
  }
  await current('Project brief', 1)
  assert.equal(await page.getByRole('tab').count(), 2, 'startup batch creates two tabs')
  await page.keyboard.press('PageDown')
  await current('Project brief', 2)
  await tab('Design reference').click()
  await current('Design reference', 1)
  await page.keyboard.press('PageDown')
  await page.keyboard.press('PageDown')
  await current('Design reference', 3)
  await tab('Project brief').click()
  await current('Project brief', 2)
  await page.keyboard.press('Control+Tab')
  await current('Design reference', 3)
  await page.keyboard.press('Control+Shift+Tab')
  await current('Project brief', 2)
  // Exercise the actual Open button and multi-selection native dialog result.
  await app.evaluate(
    ({ dialog }, filePaths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths })
    },
    [files[2]]
  )
  await page.locator('.full-view').getByRole('button', { name: 'Open', exact: true }).click()
  await current('Meeting notes', 1)
  assert.equal(await page.getByRole('tab').count(), 3)
  await tab('Design reference').click()
  await current('Design reference', 3)
  await page.screenshot({ path: 'docs/screenshots/tabs.png' })
  await tab('Design reference').focus()
  await page.keyboard.press('ArrowRight')
  await current('Meeting notes', 1)
  await page.keyboard.press('ArrowLeft')
  await current('Design reference', 3)
  // Edits belong to their document and survive switching.
  await page.getByRole('button', { name: 'Add Text', exact: true }).click()
  const layer = page.locator('.full-doc').nth(1).locator('.type-layer').last()
  await layer.click({ position: { x: 80, y: 180 } })
  await page.locator('textarea.text-editor').fill('Review this proposal')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await tab('Meeting notes').click()
  await current('Meeting notes', 1)
  assert.equal(
    await page
      .locator('.full-doc')
      .nth(2)
      .getByText('Review this proposal', { exact: true })
      .count(),
    0
  )
  await tab('Design reference').click()
  await current('Design reference', 3)
  await page
    .locator('.full-doc')
    .nth(1)
    .getByText('Review this proposal', { exact: true })
    .first()
    .waitFor({ state: 'attached' })
  await page.evaluate(() => {
    window.confirm = () => false
  })
  await page.getByRole('button', { name: 'Close Design reference', exact: true }).click()
  assert.equal(await tab('Design reference').count(), 1, 'cancel close keeps edited document')

  // Close a background tab to the left; active doc and page must stay put.
  await page.getByRole('button', { name: 'Close Project brief', exact: true }).click()
  await current('Design reference', 3)
  assert.equal(await page.getByRole('tab').count(), 2)
  await page.evaluate(() => {
    window.confirm = () => true
  })
  await page.keyboard.press('Control+w')
  await current('Meeting notes', 1)
  await page.keyboard.press('Control+w')
  await page.locator('.full-view').waitFor({ state: 'detached' })
  assert.equal(await page.getByRole('tab').count(), 0)
  // Batch opening through the dialog must enter the reader again.
  await app.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths })
  }, files)
  await page.getByRole('button', { name: 'Open', exact: true }).first().click()
  await current('Project brief', 1)
  assert.equal(await page.getByRole('tab').count(), 3)
  await page.setViewportSize({ width: 800, height: 700 })
  await tab('Meeting notes').click()
  await current('Meeting notes', 1)
  assert.equal(await tab('Meeting notes').isVisible(), true)
  const bytes = Array.from(await readFile(files[0]))
  await page.locator('.full-view').evaluate((el, bytes) => {
    const transfer = new DataTransfer()
    transfer.items.add(
      new File([new Uint8Array(bytes)], 'Dropped document.pdf', { type: 'application/pdf' })
    )
    el.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer })
    )
  }, bytes)
  await current('Dropped document', 1)
  assert.equal(await page.getByRole('tab').count(), 4, 'reader drop opens a separate document')
  assert.deepEqual(errors, [])
  console.log(
    'PASS: startup and dialog batch opening, sequential opening, tab switching, per-document pages, shortcuts, background/active/last close, narrow layout'
  )
} catch (error) {
  await app
    .windows()[0]
    ?.screenshot({ path: '.smoke/tabs-failure.png' })
    .catch(() => {})
  throw error
} finally {
  await app.close()
}
