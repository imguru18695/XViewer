# XViewer 0.2.0 — Reader and image signatures

- PDFs open in a reader with a document selector, thumbnails, page-number entry, first/last controls, Page Up/Page Down and Home/End keys.
- Fit Page, Fit Width, zoom controls, mouse-wheel paging, and selectable/copyable PDF text.
- Sign menu offers freehand drawing or a local PNG/JPEG/WebP image.
- Signature images support drag placement, proportional corner resizing, replacement, deletion, and undo/redo. Images are embedded in saved PDFs.
- Print button and Ctrl+P send the current document with edits to the system print dialog.
- Save a Copy and Ctrl+S save the current document; the organization canvas still supports combined export.
- Find now navigates to matching pages with Enter/Shift+Enter.

The print pipeline renders pages at 150 DPI and supports up to 500 pages / 256 MB per job. Automated print testing intercepts the native printer call and validates generated output; physical printer behavior still needs manual testing.

This preview installer is unsigned. The workspace does not autosave; save/export before closing. Image signatures are visual marks, not certificate signatures. Image cropping/background cleanup and persistent OCR text-layer export are not included. Upstream PDFx attribution and MIT license remain preserved.
