import { describe, expect, it } from 'vitest'
import { authenticationContextSchema } from './auth-context.js'

describe('authentication context schema', () => {
  it('preserves a renamed role environment and its effective permissions', () => {
    const context = authenticationContextSchema.parse({
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'student@example.com',
        name: 'Student',
      },
      memberships: [
        {
          institution: { id: '00000000-0000-4000-8000-000000000002', name: 'North' },
          environment: 'student',
          roles: [{
            id: '00000000-0000-4000-8000-000000000003',
            name: 'Renamed student role',
            templateKey: null,
          }],
          permissions: [{ key: 'student.read', scope: 'own' }],
        },
      ],
      isPlatformAdministrator: false,
    })

    expect(context.memberships[0]?.environment).toBe('student')
    expect(context.memberships[0]?.permissions).toEqual([{ key: 'student.read', scope: 'own' }])
  })

  it('refuses credential fields in an authenticated context', () => {
    expect(() =>
      authenticationContextSchema.parse({
        user: {
          id: '00000000-0000-4000-8000-000000000001',
          email: 'student@example.com',
          name: 'Student',
          passwordHash: 'secret',
        },
        memberships: [],
        isPlatformAdministrator: false,
      }),
    ).toThrow()
  })
})
