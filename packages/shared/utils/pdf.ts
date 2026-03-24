type PDFParseCtor = new (options: {
  data?: Uint8Array
  url?: string
}) => {
  getText: () => Promise<{ text: string }>
  destroy: () => Promise<void>
}

let pdfParseCtorPromise: Promise<PDFParseCtor> | undefined

async function getPdfParseCtor(): Promise<PDFParseCtor> {
  if (!pdfParseCtorPromise) {
    const isBrowserRuntime = typeof window !== 'undefined' && typeof window.document !== 'undefined'
    pdfParseCtorPromise = (isBrowserRuntime ? import('pdf-parse') : import('pdf-parse/node')).then(
      (module) => module.PDFParse as PDFParseCtor
    )
  }

  return pdfParseCtorPromise
}

/**
 * Extract text content from PDF data.
 * Works in both Node.js and browser environments (pdf-parse 2.x).
 *
 * @param data - PDF content as Uint8Array, ArrayBuffer, base64-encoded string, or URL
 * @returns Extracted text content
 */
export async function extractPdfText(data: Uint8Array | ArrayBuffer | string | URL): Promise<string> {
  const PDFParse = await getPdfParseCtor()

  if (data instanceof URL) {
    const parser = new PDFParse({ url: data.href })
    try {
      const result = await parser.getText()
      return result.text
    } finally {
      await parser.destroy()
    }
  }

  let buffer: Uint8Array
  if (typeof data === 'string') {
    // base64 string → Uint8Array
    const binaryString = atob(data)
    buffer = Uint8Array.from(binaryString, (c) => c.charCodeAt(0))
  } else if (data instanceof ArrayBuffer) {
    buffer = new Uint8Array(data)
  } else {
    buffer = data
  }

  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return result.text
  } finally {
    await parser.destroy()
  }
}
