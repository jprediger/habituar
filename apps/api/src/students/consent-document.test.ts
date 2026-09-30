import { describe, expect, it } from 'vitest'
import { isValidConsentDocument } from './consent-document.js'

describe('consent document', () => {
  it('rejects a file whose declared type does not match its bytes', () => {
    expect(isValidConsentDocument({ fileName: 'term.pdf', mediaType: 'application/pdf', base64: Buffer.from('<script>alert(1)</script>').toString('base64') })).toBe(false)
  })

  it('accepts common image signatures', () => {
    expect(isValidConsentDocument({ fileName: 'term.gif', mediaType: 'image/gif', base64: Buffer.from('GIF89a').toString('base64') })).toBe(true)
    expect(isValidConsentDocument({ fileName: 'term.heic', mediaType: 'image/heic', base64: Buffer.from('000000006674797068656963', 'hex').toString('base64') })).toBe(true)
  })

  it('accepts a PDF signature and refuses an oversized file', () => {
    expect(isValidConsentDocument({ fileName: 'term.pdf', mediaType: 'application/pdf', base64: Buffer.from('%PDF-1.4').toString('base64') })).toBe(true)
    expect(isValidConsentDocument({ fileName: 'term.pdf', mediaType: 'application/pdf', base64: Buffer.from(`%PDF-${'x'.repeat(2_000_000)}`).toString('base64') })).toBe(false)
  })
})
