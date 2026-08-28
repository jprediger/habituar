import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { defineIdSchema } from './branded-id'

const SOME_UUID = '2c56b90b-8b1a-4b6d-9a2a-3f1a5c9b9a11'

// Brands de exemplo só para o teste: nenhum id concreto entra no M0 (ver `plans/m0-shared-packages.md`).
const userIdSchema = defineIdSchema('UserId')

type UserId = z.infer<typeof userIdSchema>
type StudentId = z.infer<ReturnType<typeof defineIdSchema<'StudentId'>>>

describe('defineIdSchema', () => {
  it('recusa valor que não é uuid', () => {
    expect(userIdSchema.safeParse('not-a-uuid').success).toBe(false)
  })

  it('aceita um uuid válido', () => {
    expect(userIdSchema.safeParse(SOME_UUID).success).toBe(true)
  })

  it('não deixa um id de uma entidade passar por outro', () => {
    const userId: UserId = userIdSchema.parse(SOME_UUID)
    // @ts-expect-error UserId não é StudentId — a troca é erro de compilação, não bug de produção.
    const studentId: StudentId = userId
    expect(typeof studentId).toBe('string')
  })
})
