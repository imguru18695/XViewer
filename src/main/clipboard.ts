import { clipboard } from 'electron'
import { fileURLToPath } from 'node:url'

export async function clipboardBytes(type: string): Promise<Uint8Array | null> {
  for (const item of await clipboard.read()) {
    if (!item.types.includes(type)) continue
    const payload = await item.getType(type)
    if ('arrayBuffer' in payload) return new Uint8Array(await payload.arrayBuffer())
  }
  return null
}

export async function clipboardFilePaths(): Promise<string[]> {
  const paths: string[] = []
  const raw = (format: string) =>
    clipboardBytes(`electron application/osclipboard;format="${format}"`)
  if (process.platform === 'win32') {
    const bytes = await raw('FileNameW')
    if (bytes) {
      const path = Buffer.from(bytes).toString('utf16le').replace(/\0+$/g, '')
      if (path) paths.push(path)
    }
  } else if (process.platform === 'darwin') {
    const bytes = await raw('NSFilenamesPboardType')
    const plist = bytes ? Buffer.from(bytes).toString('utf8') : ''
    for (const match of plist.matchAll(/<string>([\s\S]*?)<\/string>/g)) {
      paths.push(match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
    }
    if (!paths.length) {
      const url = await raw('public.file-url')
      const text = url ? Buffer.from(url).toString('utf8') : ''
      if (text.startsWith('file://')) paths.push(fileURLToPath(text))
    }
  } else {
    for (const line of (await clipboard.readText()).split('\n')) {
      if (line.trim().startsWith('file://')) paths.push(fileURLToPath(line.trim()))
    }
  }
  return paths
}
