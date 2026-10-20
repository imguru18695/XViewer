# Validation

- `npm test`: generated PDFs exercise assembly, manifest handling, form persistence/failure, and selected-text removal.
- `npm run build`: Electron/React type checks and production compilation.
- `npm run smoke`: launch the built Electron app with generated fixtures and capture screenshots.
- `npm run build:win`: package an x64 NSIS installer.

Manual release checks remain: installed Open with behavior, uninstall cleanup, accessibility, large PDFs, unusual forms, and comprehensive redaction fixtures. Installers are currently unsigned.
