# Validation

- `npm test`: generated PDFs exercise assembly, manifest handling, form persistence/failure, selected-text removal, image sizing/undo, and signature export on rotated pages.
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

## Reader preview verification (0.2.0)

- Seven regression tests pass, including proportional image sizing, undo/redo, and PDF image embedding at 0/90/180/270-degree source rotations.
- Desktop checks cover Page Up/Down, Home/End, page-number entry, thumbnails, fit controls, and selecting text.
- A generated signature PNG is chosen through the file chooser, moved, corner-resized, replaced, deleted, restored with undo/redo, and embedded by Save a Copy.
- The real print rendering/IPC path is exercised with only the native printer call intercepted. Generated print output contains the expected page count, native-dialog options use `silent: false`, and cancellation returns control to the reader. No physical print job is submitted by tests.
- Offline OCR and redaction export checks remain in the desktop suite.
- Reader and signature screenshots are visually reviewed, including an 800px-wide window.

Physical printer behavior and hardware-specific dialog settings still require manual testing. The print path uses 150-DPI rendered pages rather than preserving PDF vectors.
