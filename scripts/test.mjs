import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
await mkdir('.smoke', { recursive: true })
await build({
  entryPoints: ['tests/pdf.test.ts'],
  outfile: '.smoke/tests.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  define: { 'import.meta.env.VITE_PDFX_WEB': 'false' }
})
const result = spawnSync(process.execPath, ['--test', '.smoke/tests.cjs'], { stdio: 'inherit' })
process.exit(result.status ?? 1)
