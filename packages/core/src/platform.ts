import { z } from 'zod'
import { membershipRoleSchema } from './auth/auth-context.js'
import { authenticatedUserSchema } from './auth/auth.schema.js'
import { institutionIdSchema, membershipIdSchema } from './identity/ids.js'
import { membershipEnvironmentSchema } from './roles.js'

function hasValidDocumentDigits(value: string, type: 'cpf' | 'cnpj'): boolean {
  const length = type === 'cpf' ? 11 : 14
  if (!/^\d+$/.test(value) || value.length !== length || /^(\d)\1+$/.test(value)) return false
  const digits = Array.from(value, Number)
  for (const position of [length - 2, length - 1]) {
    let sum = 0
    for (let index = 0; index < position; index += 1) {
      const weight = type === 'cpf' ? position + 1 - index : ((position - 1 - index) % 8) + 2
      sum += (digits[index] ?? 0) * weight
    }
    const remainder = sum % 11
    if (digits[position] !== (remainder < 2 ? 0 : 11 - remainder)) return false
  }
  return true
}

/** Cadastro completo na borda; documento sem máscara e com dígitos verificadores válidos. */
export const institutionInputSchema = z.object({
  name: z.string().trim().min(1),
  documentType: z.enum(['cpf', 'cnpj']),
  documentNumber: z.string(),
  contactName: z.string().trim().min(1),
  contactEmail: z.string().trim().toLowerCase().pipe(z.email()),
  contactPhone: z.string().trim().min(1),
}).strict().refine((value) => hasValidDocumentDigits(value.documentNumber, value.documentType), {
  path: ['documentNumber'], message: 'Invalid document check digits.',
})
export type InstitutionInput = Readonly<z.infer<typeof institutionInputSchema>>

/** Catálogo inclui instituições legadas cujo cadastro ainda não foi completado. */
export const institutionSchema = z.object({
  id: institutionIdSchema,
  name: z.string().min(1),
  documentType: z.enum(['cpf', 'cnpj']).nullable(),
  documentNumber: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.email().nullable(),
  contactPhone: z.string().nullable(),
  updatedAt: z.iso.datetime().nullable(),
}).strict().readonly()
export type Institution = z.infer<typeof institutionSchema>

export const platformRoleSchema = membershipRoleSchema.unwrap().extend({
  environment: membershipEnvironmentSchema,
}).readonly()
export type PlatformRole = z.infer<typeof platformRoleSchema>

export const platformMemberSchema = z.object({
  id: membershipIdSchema,
  user: authenticatedUserSchema.readonly(),
  environment: membershipEnvironmentSchema,
  roles: z.array(membershipRoleSchema).readonly(),
}).strict().readonly()
export type PlatformMember = z.infer<typeof platformMemberSchema>
