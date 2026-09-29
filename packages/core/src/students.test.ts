import { describe, expect, it } from 'vitest'
import { canInviteStudentAccount, deriveAgeRange, studentGuardianInputSchema } from './students.js'

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
