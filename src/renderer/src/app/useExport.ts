import { useCallback } from 'react'
import { zipSync } from 'fflate'
import { buildPdf, buildPdfx, stripExtension } from '../pdfx/format'
import { prepareExportPage } from '../pdfx/export-pages'
import { fillDocSources } from '../forms/fill'
import { renderPrintPages } from '../pdfx/print-pages'
import type { DocEntry } from '../types'
import type { MarkMap } from '../edit/types'
import type { FormValuesBySource } from '../forms/types'
import type { ElementMap } from '../elements/types'

const PDFX_FILTER = { name: 'PDFX', extensions: ['pdfx'] }
const PDF_FILTER = { name: 'PDF', extensions: ['pdf'] }
const ZIP_FILTER = { name: 'ZIP', extensions: ['zip'] }
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g

export function useExport(
  docs: DocEntry[],
  marks: MarkMap,
  formValues: FormValuesBySource,
  elements: ElementMap,
  setBusy: (busy: boolean) => void,
  flash: (message: string) => void
) {
  const preparePages = useCallback(
    (doc: DocEntry, filled: Map<string, Uint8Array>) =>
      Promise.all(
        doc.pages.map((p) =>
          prepareExportPage(p, marks[p.id], filled.get(p.source.id), elements[p.id])
        )
      ),
    [marks, elements]
  )

  const exportCollection = useCallback(
    async (kind: 'pdfx' | 'pdf') => {
      if (docs.length === 0) {
        flash('Nothing to export')
        return
      }
      const path = await window.api.chooseSavePath(
        `untitled.${kind}`,
        kind === 'pdfx' ? PDFX_FILTER : PDF_FILTER
      )
      if (!path) return
      setBusy(true)
      try {
        const filename = path.split(/[\\/]/).pop() ?? `untitled.${kind}`
        const filled = await fillDocSources(docs, formValues)
        const documents = await Promise.all(
          docs.map(async (doc) => ({ name: doc.name, pages: await preparePages(doc, filled) }))
        )
        const bytes =
          kind === 'pdf'
            ? await buildPdf(documents.flatMap((doc) => doc.pages))
            : await buildPdfx(documents, stripExtension(filename).replace(/\.pdf$/i, ''))
        const saved = await window.api.writeFile(path, bytes)
        flash(`Saved ${saved}`)
      } catch (error) {
        console.error('Export failed', error)
        flash(error instanceof Error ? error.message : 'Export failed')
      } finally {
        setBusy(false)
      }
    },
    [docs, preparePages, formValues, flash, setBusy]
  )

  const exportZip = useCallback(async () => {
    if (docs.length === 0) {
      flash('Nothing to export')
      return
    }
    const path = await window.api.chooseSavePath('untitled.zip', ZIP_FILTER)
    if (!path) return
    setBusy(true)
    try {
      const filled = await fillDocSources(docs, formValues)
      const entries: Record<string, Uint8Array> = {}
      const used = new Set<string>()
      for (const doc of docs) {
        const safeName = doc.name.replace(ILLEGAL_FILENAME_CHARS, '-').trim() || 'Untitled'
        let filename = `${safeName}.pdf`
        for (let n = 2; used.has(filename); n++) filename = `${safeName} (${n}).pdf`
        used.add(filename)
        entries[filename] = await buildPdf(await preparePages(doc, filled))
      }
      const saved = await window.api.writeFile(path, zipSync(entries))
      flash(`Saved ${saved}`)
    } catch (error) {
      console.error('Export failed', error)
      flash(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }, [docs, preparePages, formValues, flash, setBusy])

  const documentPdf = useCallback(
    async (docId?: string) => {
      const selected = docId ? docs.filter((d) => d.id === docId) : docs
      if (!selected.length) throw new Error('Open a PDF first.')
      const filled = await fillDocSources(selected, formValues)
      const pages = await Promise.all(selected.map((doc) => preparePages(doc, filled)))
      return buildPdf(pages.flat())
    },
    [docs, formValues, preparePages]
  )

  const saveDocument = useCallback(
    async (docId: string) => {
      const doc = docs.find((d) => d.id === docId)
      if (!doc) return
      const path = await window.api.chooseSavePath(`${doc.name}.pdf`, PDF_FILTER)
      if (!path) return
      setBusy(true)
      try {
        flash(`Saved ${await window.api.writeFile(path, await documentPdf(docId))}`)
      } catch (error) {
        flash(error instanceof Error ? error.message : 'Could not save PDF.')
      } finally {
        setBusy(false)
      }
    },
    [docs, documentPdf, flash, setBusy]
  )

  const printDocument = useCallback(
    async (docId?: string) => {
      setBusy(true)
      try {
        const result = await window.api.printPages(await renderPrintPages(await documentPdf(docId)))
        flash(result === 'printed' ? 'Sent to printer' : 'Printing canceled')
      } catch (error) {
        flash(error instanceof Error ? error.message : 'Could not print PDF.')
      } finally {
        setBusy(false)
      }
    },
    [documentPdf, setBusy, flash]
  )

  return { exportCollection, exportZip, saveDocument, printDocument }
}
