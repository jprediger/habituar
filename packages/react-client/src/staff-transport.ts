import type { InvitationId, MembershipId, RoleId } from '@habituar/core/identity/ids'
import type { Invitation } from '@habituar/core/invitations'
import type { RoleBundleCatalogEntry, RoleBundleSelection } from '@habituar/core/role-bundles'
import type { MembershipEnvironment } from '@habituar/core/roles'
import type { StaffEnvironment, StaffRole } from '@habituar/core/staff'
import type { ApiClient } from './api-client.js'
import { queryKeys } from './query-keys.js'
import type { StaffInvitationStatus, StaffManagementContext, StaffMemberDetail, StaffMemberSummary } from './staff-management.js'

/** Mesmo tamanho de página nas duas áreas, para a navegação entre páginas não mudar de ritmo. */
export const STAFF_PAGE_SIZE = 20

export type StaffPage<Item> = Readonly<{ items: readonly Item[]; total: number; page: number; pageSize: number }>
export type MemberQuery = Readonly<{ search: string | undefined; environment: StaffEnvironment | undefined; page: number }>
export type InvitationQuery = Readonly<{ status: StaffInvitationStatus | undefined; page: number }>
export type CreatedInvitation = Readonly<{ invitation: Invitation; inviteUrl: string }>

/**
 * Operações de gestão com o transporte já escolhido pelo contexto. As telas não sabem se
 * falam com a rota da instituição ou com o espelho da plataforma; a diferença de forma
 * entre as duas (a plataforma lista sem paginação nem versão) termina aqui.
 */
export type StaffTransport = Readonly<{
  queryScope: readonly unknown[]
  invalidationScope: readonly unknown[]
  listMembers: (query: MemberQuery) => Promise<StaffPage<StaffMemberSummary>>
  getMember: (membershipId: MembershipId) => Promise<StaffMemberDetail>
  replaceMemberRoles: (input: Readonly<{ membershipId: MembershipId; roleIds: readonly RoleId[]; expectedVersion: number }>) => Promise<StaffMemberDetail>
  removeMember: (input: Readonly<{ membershipId: MembershipId; expectedVersion: number }>) => Promise<void>
  listInvitations: (query: InvitationQuery) => Promise<StaffPage<Invitation>>
  createInvitation: (input: Readonly<{ email: string; environment: StaffEnvironment; roleIds: readonly RoleId[] }>) => Promise<CreatedInvitation>
  resendInvitation: (invitationId: InvitationId) => Promise<CreatedInvitation>
  revokeInvitation: (invitationId: InvitationId) => Promise<void>
  listRoles: () => Promise<readonly StaffRole[]>
  getRole: (roleId: RoleId) => Promise<StaffRole>
  listRoleBundles: () => Promise<readonly RoleBundleCatalogEntry[]>
  createRole: (input: Readonly<{ templateRoleId: RoleId; name: string; bundles: readonly RoleBundleSelection[] }>) => Promise<StaffRole>
  updateRole: (input: Readonly<{ roleId: RoleId; name: string; bundles: readonly RoleBundleSelection[]; expectedVersion: number }>) => Promise<StaffRole>
  deleteRole: (input: Readonly<{ roleId: RoleId; expectedVersion: number }>) => Promise<void>
}>

function isStaffEnvironment(environment: MembershipEnvironment): environment is StaffEnvironment {
  return environment === 'professional' || environment === 'monitor'
}

// Comparação sem acento e sem caixa: quem busca "joao" espera encontrar "João".
function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
}

function paginate<Item>(items: readonly Item[], page: number): StaffPage<Item> {
  const start = (page - 1) * STAFF_PAGE_SIZE
  return { items: items.slice(start, start + STAFF_PAGE_SIZE), total: items.length, page, pageSize: STAFF_PAGE_SIZE }
}

/**
 * Transporte de gestão para um contexto. A plataforma reaproveita as leituras de lista
 * da 1B, que não paginam: busca, filtro e página são aplicados aqui, com ordenação
 * estável por nome e id, para as duas áreas se comportarem igual na tela.
 */
export function createStaffTransport(apiClient: ApiClient, context: StaffManagementContext): StaffTransport {
  const institutionId = context.institutionId
  const path = { institutionId }

  if (context.kind === 'institution') {
    const staff = apiClient.staff
    return {
      queryScope: queryKeys.institutionStaff(institutionId),
      invalidationScope: queryKeys.institutionStaff(institutionId),
      listMembers: (query) => staff.listMembers({ ...path, search: query.search, environment: query.environment, page: query.page, pageSize: STAFF_PAGE_SIZE }),
      getMember: (membershipId) => staff.getMember({ ...path, membershipId }),
      replaceMemberRoles: (input) => staff.replaceMemberRoles({ ...path, ...input, roleIds: [...input.roleIds] }),
      removeMember: async (input) => { await staff.removeMember({ ...path, ...input }) },
      listInvitations: (query) => staff.listInvitations({ ...path, status: query.status, page: query.page, pageSize: STAFF_PAGE_SIZE }),
      createInvitation: (input) => staff.createInvitation({ ...path, ...input, roleIds: [...input.roleIds] }),
      resendInvitation: (invitationId) => staff.resendInvitation({ ...path, invitationId }),
      revokeInvitation: async (invitationId) => { await staff.revokeInvitation({ ...path, invitationId }) },
      listRoles: () => staff.listRoles(path),
      getRole: (roleId) => staff.getRole({ ...path, roleId }),
      listRoleBundles: () => staff.listRoleBundles(path),
      createRole: (input) => staff.createRole({ ...path, ...input, bundles: [...input.bundles] }),
      updateRole: (input) => staff.updateRole({ ...path, ...input, bundles: [...input.bundles] }),
      deleteRole: async (input) => { await staff.deleteRole({ ...path, ...input }) },
    }
  }

  const platform = apiClient.platform
  return {
    queryScope: queryKeys.platformInstitutionStaff(institutionId),
    // A plataforma também mostra as listas da 1B desta instituição: invalidar a instituição
    // inteira mantém as duas leituras coerentes depois de uma escrita.
    invalidationScope: queryKeys.platformInstitution(institutionId),
    listMembers: async (query) => {
      const members = await platform.listMembers(path)
      const search = query.search === undefined ? undefined : normalizeForSearch(query.search)
      const matching = members.flatMap((member): StaffMemberSummary[] => {
        const environment = member.environment
        if (!isStaffEnvironment(environment)) return []
        if (query.environment !== undefined && environment !== query.environment) return []
        if (search !== undefined && !normalizeForSearch(`${member.user.name} ${member.user.email}`).includes(search)) return []
        return [{ id: member.id, user: member.user, environment, roles: member.roles }]
      })
      const sorted = [...matching].sort((first, second) => first.user.name.localeCompare(second.user.name, 'pt-BR') || first.id.localeCompare(second.id))
      return paginate(sorted, query.page)
    },
    getMember: (membershipId) => platform.getMember({ ...path, membershipId }),
    replaceMemberRoles: (input) => platform.replaceMemberRoles({ ...path, ...input, roleIds: [...input.roleIds] }),
    removeMember: async (input) => { await platform.removeMember({ ...path, ...input }) },
    listInvitations: async (query) => {
      const invitations = await platform.listInvitations(path)
      const matching = invitations.filter((invitation) => query.status === undefined || invitation.state.status === query.status)
      const sorted = [...matching].sort((first, second) => second.createdAt.localeCompare(first.createdAt) || first.id.localeCompare(second.id))
      return paginate(sorted, query.page)
    },
    createInvitation: (input) => platform.createInvitation({ ...path, ...input, roleIds: [...input.roleIds] }),
    resendInvitation: (invitationId) => platform.resendInvitation({ ...path, invitationId }),
    revokeInvitation: async (invitationId) => { await platform.revokeInvitation({ ...path, invitationId }) },
    // A lista da 1B não traz concessões nem impacto; o detalhe de cada papel traz, e o
    // número de papéis de uma instituição é pequeno (templates mais personalizados).
    listRoles: async () => {
      const roles = await platform.listRoles(path)
      return Promise.all(roles.map((role) => platform.getRole({ ...path, roleId: role.id })))
    },
    getRole: (roleId) => platform.getRole({ ...path, roleId }),
    listRoleBundles: () => platform.listRoleBundles(path),
    createRole: (input) => platform.createRole({ ...path, ...input, bundles: [...input.bundles] }),
    updateRole: (input) => platform.updateRole({ ...path, ...input, bundles: [...input.bundles] }),
    deleteRole: async (input) => { await platform.deleteRole({ ...path, ...input }) },
  }
}
