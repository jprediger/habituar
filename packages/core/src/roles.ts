import { z } from 'zod'

/** Identidade institucional do vínculo, independente dos papéis concedidos. */
export const membershipEnvironmentSchema = z.enum(['student', 'professional', 'monitor'])

export type MembershipEnvironment = z.infer<typeof membershipEnvironmentSchema>

export const roleTemplateKeySchema = z.enum([
  'team-management',
  'care-assigned',
  'care-institution',
  'monitoring',
  'student',
])
export type RoleTemplateKey = z.infer<typeof roleTemplateKeySchema>
