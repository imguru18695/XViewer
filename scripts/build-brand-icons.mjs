import { createRequire } from 'node:module'
import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const { convertIcon } = require('app-builder-lib/out/util/iconConverter.js')
const { runIconsTool } = require('app-builder-lib/out/toolsets/icons.js')

// Format conversion only: the approved PNG remains the design source.
const source = resolve('assets/branding/page-wing.png')
for (const format of ['ico', 'icns', 'set']) {
  const outDir = resolve('.smoke/branding', format)
  await mkdir(outDir, { recursive: true })
  if (format === 'set') {
    await runIconsTool({ inputFile: source, outputFormat: 'set', outDir })
    await copyFile(resolve(outDir, '512x512.png'), resolve('build/page-wing.png'))
    console.log('Created build/page-wing.png')
    continue
  }
  const result = await convertIcon({
    sources: [source],
    fallbackSources: [],
    roots: [process.cwd()],
    format,
    outDir
  })
  if (result.isFallback || !result.icons.length)
    throw new Error(`Could not generate ${format} icons`)
  await copyFile(result.icons[0].file, resolve(`build/page-wing.${format}`))
  console.log(`Created build/page-wing.${format}`)
}
