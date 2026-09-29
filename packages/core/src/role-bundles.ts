import { z } from 'zod'
import { type EffectivePermission, effectivePermissionSchema } from './auth/auth-context.js'
import { PERMISSION_SCOPES, type PermissionKey, type PermissionScope } from './permissions/permission-catalog.js'
import type { MembershipEnvironment } from './roles.js'

export const ROLE_BUNDLE_KEYS = [
  'team-read',
  'team-invite',
  'role-assign',
  'member-remove',
  'role-customize',
  'student-create',
  'student-read',
  'student-update',
  'guardian-link',
  'guardian-unlink',
] as const

export const roleBundleKeySchema = z.enum(ROLE_BUNDLE_KEYS)
export type RoleBundleKey = z.infer<typeof roleBundleKeySchema>

type RoleBundleDefinition = Readonly<{
  labelKey: string
  permissions: readonly PermissionKey[]
  scopesByEnvironment: Readonly<Partial<Record<MembershipEnvironment, readonly PermissionScope[]>>>
}>

/**
 * Matriz fechada ação × ambiente × alcance que um papel personalizado pode receber. O que
 * não aparece aqui não é personalizável: aluno não tem entrada, monitor só consulta com
 * `assigned`, e gestão só existe com `institution`. Bundle clínico entra na etapa 5.
 */
export const ROLE_BUNDLE_CATALOG: Readonly<Record<RoleBundleKey, RoleBundleDefinition>> = {
  'team-read': { labelKey: 'roleBundles.teamRead', permissions: ['membership.read'], scopesByEnvironment: { professional: ['institution'] } },
  'team-invite': { labelKey: 'roleBundles.teamInvite', permissions: ['membership.invite'], scopesByEnvironment: { professional: ['institution'] } },
  'role-assign': { labelKey: 'roleBundles.roleAssign', permissions: ['role.assign'], scopesByEnvironment: { professional: ['institution'] } },
  'member-remove': { labelKey: 'roleBundles.memberRemove', permissions: ['membership.remove'], scopesByEnvironment: { professional: ['institution'] } },
  'role-customize': { labelKey: 'roleBundles.roleCustomize', permissions: ['role.manage'], scopesByEnvironment: { professional: ['institution'] } },
  'student-create': { labelKey: 'roleBundles.studentCreate', permissions: ['student.create'], scopesByEnvironment: { professional: ['institution'] } },
  'student-read': { labelKey: 'roleBundles.studentRead', permissions: ['student.read'], scopesByEnvironment: { professional: ['assigned', 'institution'], monitor: ['assigned'] } },
  'student-update': { labelKey: 'roleBundles.studentUpdate', permissions: ['student.update'], scopesByEnvironment: { professional: ['assigned', 'institution'] } },
  'guardian-link': { labelKey: 'roleBundles.guardianLink', permissions: ['guardian.link'], scopesByEnvironment: { professional: ['assigned', 'institution'] } },
  'guardian-unlink': { labelKey: 'roleBundles.guardianUnlink', permissions: ['guardian.unlink'], scopesByEnvironment: { professional: ['assigned', 'institution'] } },
}

export const roleBundleSelectionSchema = z.object({
  bundle: roleBundleKeySchema,
  scope: z.enum(PERMISSION_SCOPES),
}).strict().readonly()
export type RoleBundleSelection = z.infer<typeof roleBundleSelectionSchema>

// Um alcance por bundle: dois alcances da mesma ação são outra forma de pedir o maior deles,
// e a leitura de volta a partir de `role_permissions` deixaria de ser única.
export const roleBundleSelectionsSchema = z.array(roleBundleSelectionSchema).min(1).readonly()
  .refine(selections => new Set(selections.map(selection => selection.bundle)).size === selections.length, { message: 'Duplicate bundle.' })

export const roleBundleCatalogEntrySchema = z.object({
  key: roleBundleKeySchema,
  labelKey: z.string().min(1),
  permissions: z.array(effectivePermissionSchema.shape.key).readonly(),
  scopesByEnvironment: z.object({
    student: z.array(z.enum(PERMISSION_SCOPES)).readonly(),
    professional: z.array(z.enum(PERMISSION_SCOPES)).readonly(),
    monitor: z.array(z.enum(PERMISSION_SCOPES)).readonly(),
  }).strict().readonly(),
}).strict().readonly()
export type RoleBundleCatalogEntry = z.infer<typeof roleBundleCatalogEntrySchema>

/** Catálogo em formato de transporte, para a rota que o expõe ao cliente. */
export function listRoleBundleCatalog(): readonly RoleBundleCatalogEntry[] {
  return ROLE_BUNDLE_KEYS.map(key => {
    const definition = ROLE_BUNDLE_CATALOG[key]
    return roleBundleCatalogEntrySchema.parse({
      key,
      labelKey: definition.labelKey,
      permissions: definition.permissions,
      scopesByEnvironment: {
        student: definition.scopesByEnvironment.student ?? [],
        professional: definition.scopesByEnvironment.professional ?? [],
        monitor: definition.scopesByEnvironment.monitor ?? [],
      },
    })
  })
}

export type BundleResolution =
  | { readonly status: 'valid'; readonly grants: readonly EffectivePermission[] }
  | { readonly status: 'invalid' }

/**
 * Único tradutor de bundles para concessões atômicas. Recusa a combinação inteira quando
 * qualquer seleção sai da matriz: gravar só a parte válida mudaria o papel em silêncio.
 */
export function resolveBundleGrants(environment: MembershipEnvironment, selections: readonly RoleBundleSelection[]): BundleResolution {
  if (selections.length === 0) return { status: 'invalid' }
  if (new Set(selections.map(selection => selection.bundle)).size !== selections.length) return { status: 'invalid' }
  const grants: EffectivePermission[] = []
  for (const selection of selections) {
    const definition = ROLE_BUNDLE_CATALOG[selection.bundle]
    const allowedScopes = definition.scopesByEnvironment[environment] ?? []
    if (!allowedScopes.includes(selection.scope)) return { status: 'invalid' }
    for (const key of definition.permissions) grants.push({ key, scope: selection.scope })
  }
  return { status: 'valid', grants }
}

export type BundleReading =
  | { readonly status: 'representable'; readonly bundles: readonly RoleBundleSelection[] }
  | { readonly status: 'not-representable' }

/**
 * Leitura inversa, das concessões gravadas para bundles. Papel de sistema como `student`
 * pode não caber na matriz; quem exibe decide como mostrar esse caso, sem inventar bundle.
 */
export function readBundlesFromGrants(environment: MembershipEnvironment, grants: readonly EffectivePermission[]): BundleReading {
  const bundles: RoleBundleSelection[] = []
  const consumed = new Set<string>()
  for (const key of ROLE_BUNDLE_KEYS) {
    const definition = ROLE_BUNDLE_CATALOG[key]
    const scopes = PERMISSION_SCOPES.filter(scope => definition.permissions.every(permission => grants.some(grant => grant.key === permission && grant.scope === scope)))
    if (scopes.length > 1) return { status: 'not-representable' }
    const [scope] = scopes
    if (scope === undefined) continue
    if (!(definition.scopesByEnvironment[environment] ?? []).includes(scope)) return { status: 'not-representable' }
    bundles.push({ bundle: key, scope })
    for (const permission of definition.permissions) consumed.add(`${permission}@${scope}`)
  }
  const isComplete = grants.every(grant => consumed.has(`${grant.key}@${grant.scope}`))
  return isComplete ? { status: 'representable', bundles } : { status: 'not-representable' }
}
