import { describe, expect, it } from 'vitest'
import { canInviteStudentAccount, createStudentInputSchema, deriveAgeRange, listStudentsInputSchema, studentGuardianInputSchema } from './students.js'

describe('student age rules', () => {
  it('moves to the next age range on the birthday', () => {
    expect(deriveAgeRange('2015-09-30', '2026-09-29')).toBe('6-10')
    expect(deriveAgeRange('2015-09-30', '2026-09-30')).toBe('11-14')
  })

  it('allows own account invitations starting at age twelve', () => {
    expect(canInviteStudentAccount('2014-09-30', '2026-09-29')).toBe(false)
    expect(canInviteStudentAccount('2014-09-29', '2026-09-29')).toBe(true)
  })

  it('requires explicit nullable guardian contacts at the boundary', () => {
    expect(studentGuardianInputSchema.safeParse({ fullName: 'Maria', relationship: 'mother', email: null, phone: null }).success).toBe(true)
    expect(studentGuardianInputSchema.safeParse({ fullName: 'Maria', relationship: 'other' }).success).toBe(false)
  })
})

describe('listagem de alunos pela URL', () => {
  const institutionId = 'c1000000-0000-4000-8000-000000000001'

  it('lê o filtro de arquivados vindo como texto da query string', () => {
    expect(listStudentsInputSchema.parse({ institutionId, archived: 'false' }).archived).toBe(false)
    expect(listStudentsInputSchema.parse({ institutionId, archived: 'true' }).archived).toBe(true)
    expect(listStudentsInputSchema.parse({ institutionId, archived: false }).archived).toBe(false)
  })

  it('recusa texto que não é booleano em vez de tratá-lo como verdadeiro', () => {
    expect(listStudentsInputSchema.safeParse({ institutionId, archived: 'no' }).success).toBe(false)
  })
})

describe('institutional consent input', () => {
  it('requires an attached document when the institution records a signed term', () => {
    const input = { institutionId: 'ca4a057e-7417-48a5-ade3-bd8ff83e2f78', fullName: 'Ana', socialName: null, birthDate: '2015-01-01', institutionalConsent: { signedOn: '2026-01-01', termVersion: '2026-01' } }
    expect(createStudentInputSchema.safeParse(input).success).toBe(false)
    expect(createStudentInputSchema.safeParse({ ...input, institutionalConsent: { ...input.institutionalConsent, document: { fileName: 'term.pdf', mediaType: 'application/pdf', base64: 'JVBERi0xLjQ=' } } }).success).toBe(true)
  })
})
