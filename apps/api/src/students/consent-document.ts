import type { ConsentDocumentInput } from '@habituar/core/students'

/** Confere o conteúdo real e o limite do anexo antes de associá-lo a um consentimento. */
export function isValidConsentDocument(document: ConsentDocumentInput): boolean {
  const bytes = Buffer.from(document.base64, 'base64')
  if (bytes.length === 0 || bytes.length > 2_000_000) return false
  if (document.mediaType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-'
  if (document.mediaType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
  if (document.mediaType === 'image/jpeg') return bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))
  if (document.mediaType === 'image/webp') return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  if (document.mediaType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))
  const brand = bytes.subarray(8, 12).toString('ascii')
  return bytes.subarray(4, 8).toString('ascii') === 'ftyp' && (document.mediaType === 'image/heic' ? ['heic', 'heix', 'hevc'].includes(brand) : ['mif1', 'heif'].includes(brand))
}
