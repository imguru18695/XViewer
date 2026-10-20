# XViewer

A local Windows desktop workspace for viewing, organizing, annotating, and searching PDFs.

Built on [PDFx](https://github.com/AlexandrosGounis/pdfx) by Alex Gounis. XViewer preserves the upstream MIT license and Git history. The rendering, canvas, markup, OCR, and redaction engines are inherited. Windows packaging, export corrections, regression coverage, and project documentation are XViewer contributions.

## Getting started

Download the Windows setup executable from [Releases](https://github.com/imguru18695/XViewer/releases). Install and launch XViewer, then choose **Open documents** or drag PDFs into the window. Use **Ctrl+O** to open and **Ctrl+F** to search. In File Explorer choose **Open with → XViewer**. Windows Default apps lets you select it as your preferred PDF application.

Double-click a page for full view. Choose **Edit** to highlight, draw a signature, add text, or redact text. Choose **Done**, then **Export PDF** to save a new document. Source files are not automatically overwritten. Export before closing: the workspace does not autosave.

![XViewer desktop workspace](docs/screenshots/workspace.png)

## Features and limits

| Feature | Behavior |
| --- | --- |
| View and search | Multiple PDFs on a zoomable canvas |
| Organize | Reorder, move, remove pages; export combined PDF or documents as ZIP |
| Annotate | Highlights, freehand drawing, added text |
| Forms | Existing text fields and checkboxes; filled fields may be flattened |
| OCR | Local scanned-page search; bundled English, German, French, Spanish assets |
| Redaction | Content removal on export, with raster fallback for unsupported content |
| Windows integration | Installer, PDF/PDFX associations, single-instance file opening |

OCR search does **not** currently add a persistent text layer to exported scans. Redaction has basic regression coverage; complex documents need validation before confidential use. Drawn signatures are visual marks, not certificate signatures. Existing paragraph editing, Office conversion, PDF/A, and password management are outside this release.

PDF processing and OCR run locally. The inherited optional AI assistant requires provider configuration and sends document context to that provider when used. Core tools require no API key. Never commit keys.

## Development

Requires Node.js 22 or 24 and npm on Windows.

```powershell
npm ci
npm run dev
npm test
npm run build:win
```

Installers appear in `dist/`. After `npm run build`, run `npm run smoke` to launch Electron with a generated PDF and capture screenshots.

## XViewer contributions

- Separate Windows app identity, per-user installer, and PDF associations.
- Buffer file requests received while the renderer starts.
- Plain PDF exports omit collection manifests and original document names.
- Failed form filling stops export rather than silently saving unfilled content.
- Regression tests, desktop smoke checks, Windows CI, and release automation.

See [architecture](docs/ARCHITECTURE.md), [validation](docs/VALIDATION.md), and [roadmap](docs/ROADMAP.md). This is an early derivative project; the list above distinguishes our changes from inherited functionality.

## License

MIT. Upstream copyright remains with Alex Gounis; see [LICENSE](LICENSE) and [NOTICE](NOTICE). Dependencies retain their own licenses.
