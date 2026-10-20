import { BrowserWindow } from 'electron'
import { getMainWindow } from './window'

export interface PrintPage {
  png: string
  width: number
  height: number
}

export function printHtml(pages: PrintPage[]): string {
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > 500) {
    throw new Error('Choose between 1 and 500 pages to print.')
  }
  let size = 0
  for (const p of pages) {
    if (
      typeof p.png !== 'string' ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p.png) ||
      !Number.isFinite(p.width) ||
      !Number.isFinite(p.height) ||
      p.width <= 0 ||
      p.height <= 0 ||
      p.width > 14400 ||
      p.height > 14400
    )
      throw new Error('Invalid print page.')
    size += p.png.length
  }
  if (size > 256 * 1024 * 1024)
    throw new Error('This print job is too large. Print fewer pages at a time.')
  return `<!doctype html><meta charset="utf-8"><title>XViewer Print</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
    <style>html,body{margin:0;padding:0;background:white}section{break-after:page;overflow:hidden}section:last-child{break-after:auto}
    img{display:block;width:100%;height:100%;object-fit:contain}
    ${pages.map((p, i) => `@page sheet${i}{size:${p.width}pt ${p.height}pt;margin:0}.sheet${i}{page:sheet${i};width:${p.width}pt;height:${p.height}pt}`).join('')}</style>
    ${pages.map((p, i) => `<section class="sheet${i}"><img src="${p.png}" alt="Page ${i + 1}"></section>`).join('')}`
}

let printing = false
export async function printPages(pages: PrintPage[]): Promise<'printed' | 'canceled'> {
  if (printing) throw new Error('A print dialog is already open.')
  const html = printHtml(pages)
  printing = true
  const parent = getMainWindow()
  const win = new BrowserWindow({
    show: false,
    title: 'XViewer Print',
    ...(parent ? { parent } : {}),
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'xviewer-print'
    }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  try {
    await win.loadURL('data:text/html;charset=utf-8;base64,' + Buffer.from(html).toString('base64'))
    await win.webContents.executeJavaScript(
      'Promise.all(Array.from(document.images, image => image.decode())).then(() => true)'
    )
    return await new Promise((resolve, reject) => {
      win.webContents.print(
        { silent: false, printBackground: true, margins: { marginType: 'none' } },
        (ok, reason) => {
          if (ok) resolve('printed')
          else if (/cancel/i.test(reason)) resolve('canceled')
          else reject(new Error(reason || 'Printing failed. Check your printer.'))
        }
      )
    })
  } finally {
    if (!win.isDestroyed()) win.destroy()
    printing = false
  }
}
