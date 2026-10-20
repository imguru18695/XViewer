# XViewer 0.1.0 — Windows preview

First Windows preview of XViewer, derived from PDFx with upstream attribution and history preserved.

- Local PDF viewing, organization, annotation, simple form filling, OCR search, and redaction.
- x64 Windows installer with PDF/PDFX Open with associations.
- Plain PDF export omits collection names/manifests.
- Form failures stop export instead of silently losing entered values.
- Updated Electron/PDF.js dependencies and compatible clipboard/form APIs.
- Automated PDF regression coverage and desktop checks for opening, search, offline OCR, and redaction export.

This installer is unsigned. Windows may display a reputation warning. OCR currently supports in-app search rather than searchable scan export. The workspace does not autosave; export before closing. Redaction is tested on generated fixtures, not comprehensively certified for every PDF structure. Certificate signatures and existing-paragraph editing are not included.

See README for setup, feature limits, and upstream credits.
