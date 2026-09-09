import { z } from 'zod'
import { institutionIdSchema, roleIdSchema } from '../identity/ids.js'
import { PERMISSION_CATALOG, PERMISSION_SCOPES } from '../permissions/permission-catalog.js'
import { roleEnvironmentSchema } from '../roles.js'
import { authenticatedUserSchema } from './auth.schema.js'

/** Permissão resolvida para um vínculo, sem delegar autorização ao cliente. */
export const effectivePermissionSchema = z
  .object({ key: z.enum(PERMISSION_CATALOG), scope: z.enum(PERMISSION_SCOPES) })
  .strict()
export type EffectivePermission = Readonly<z.infer<typeof effectivePermissionSchema>>

/** Vínculo institucional já acompanhado do papel e das permissões efetivas. */
export const membershipContextSchema = z
  .object({
    institution: z.object({ id: institutionIdSchema, name: z.string().min(1) }).strict(),
    role: z
      .object({ id: roleIdSchema, name: z.string().min(1), environment: roleEnvironmentSchema })
      .strict(),
    permissions: z.array(effectivePermissionSchema).readonly(),
  })
  .strict()
export type MembershipContext = Readonly<z.infer<typeof membershipContextSchema>>

/** Contrato seguro devolvido por uma sessão autenticada, limitado à identidade e vínculos. */
export const authenticationContextSchema = z
  .object({
    user: authenticatedUserSchema.strict(),
    memberships: z.array(membershipContextSchema).readonly(),
    isPlatformAdministrator: z.boolean(),
  })
  .strict()
export type AuthenticationContext = Readonly<z.infer<typeof authenticationContextSchema>>
