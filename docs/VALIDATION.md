# Validation

- `npm test`: generated PDFs exercise assembly, manifest handling, form persistence/failure, and selected-text removal.
- `npm run build`: Electron/React type checks and production compilation.
- `npm run smoke`: launch the built Electron app with generated fixtures and capture screenshots.
- `npm run build:win`: package an x64 NSIS installer.

Manual release checks remain: installed Open with behavior, uninstall cleanup, accessibility, large PDFs, unusual forms, and comprehensive redaction fixtures. Installers are currently unsigned.

## Windows preview verification — October 20, 2026

- Production TypeScript checks and build passed.
- All five generated-PDF regression tests passed.
- Desktop smoke checks passed against both the development build and packaged `XViewer.exe`.
- Offline OCR found text in a generated image-only PDF with external HTTPS requests blocked.
- Desktop redaction exported a three-page PDF; its rasterized first page contained an image and no source font resources. The separate content-stream test verified selected glyph removal and preservation of unrelated text.
- x64 NSIS installer generated successfully. Authenticode status: NotSigned.

This establishes the tested fixture workflows, not comprehensive compatibility with every PDF.
