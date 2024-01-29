# This is an extension of [pdf-lib](https://www.npmjs.com/package/pdf-lib) that provides invremental save of altered pdf documents. 

For the full documentation go to [pdf-lib](https://www.npmjs.com/package/pdf-lib) page. The documentation on this page is only related to the incremental feature.

## Table of Contents

- ...
- Usage Examples
  - ...
  - [Incremental Document Modification](#incremental-document-modification)
  - ...
- ...



### Incremental Document Modification

The incremental modification saving is designed to be used for pdf signing. The signature is added to an existing page, then only the 'incremental' PDF is generated and concatenated to the initial version.

_This example produces [this PDF](assets/pdfs/examples/incremental_document_modification.pdf)_ (when [this PDF](assets/pdfs/simple.pdf) is used for the `existingPdfBytes` variable).

<!-- prettier-ignore -->
```js
import { PDFDocument, StandardFonts } from 'pdf-lib';

// This should be a Uint8Array or ArrayBuffer
// This data can be obtained in a number of different ways
// If your running in a Node environment, you could use fs.readFile()
// In the browser, you could make a fetch() call and use res.arrayBuffer()
const existingPdfBytes = ...

// Load a PDFDocument from the existing PDF bytes
const pdfDoc = await PDFDocument.load(existingPdfBytes)

// Take a snapshot of the document
const snapshot = pdfDoc.takeSnapshot();

// Get the first page of the document
const pages = pdfDoc.getPages()
const firstPage = pages[0]

// Mark the page as modified
snapshot.markRefForSave(firstPage.ref)

// Draw a string of text diagonally across the first page
firstPage.drawText('Incremental saving is also awesome!', {
  x: 50,
  y: 4 * fontSize,
  size: fontSize
})

// Serialize the PDFDocument to bytes (a Uint8Array)
const pdfIncrementalBytes = await pdfDoc.saveIncremental(snapshot)
const pdfBytes = Buffer.concatenate([ existingPdfBytes, pdfIncrementalBytes ])

// For example, `pdfBytes` can be:
//   • Written to a file in Node
//   • Downloaded from the browser
//   • Rendered in an <iframe>
```

## License

[MIT](LICENSE.md)
