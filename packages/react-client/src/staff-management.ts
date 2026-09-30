/**
 * Entrypoint da gestão de equipe: contexto discriminado (instituição ou plataforma),
 * capacidades derivadas das concessões, falhas que a interface sabe explicar e a forma
 * dos estados que os hooks de equipe, convites e papéis devolvem. Não decide autorização:
 * a UI só omite o que não pode oferecer, e o servidor continua sendo a barreira.
 */
import type { EffectivePermission } from '@habituar/core/auth/context'
import { coversAllGrants } from '@habituar/core/delegation'
import type { InstitutionId, InvitationId, RoleId } from '@habituar/core/identity/ids'
import type { Invitation } from '@habituar/core/invitations'
import type { PermissionKey, PermissionScope } from '@habituar/core/permissions'
import type { RoleBundleKey } from '@habituar/core/role-bundles'
import type { StaffEnvironment, StaffMember, StaffRole } from '@habituar/core/staff'
import type { FieldError } from './form.js'

/**
 * Quem administra a equipe desta tela. A plataforma não carrega concessões de tenant:
 * ela é autorizada por `institution.configure` no servidor, sem simular sessão de tenant.
 */
export type StaffManagementContext =
  | Readonly<{ kind: 'institution'; institutionId: InstitutionId; permissions: readonly EffectivePermission[] }>
  | Readonly<{ kind: 'platform'; institutionId: InstitutionId }>

export type StaffCapabilities = Readonly<{
  canReadTeam: boolean
  canInvite: boolean
  canRevokeInvitations: boolean
  canAssignRoles: boolean
  canRemoveMembers: boolean
  canManageRoles: boolean
}>

const PLATFORM_CAPABILITIES: StaffCapabilities = {
  canReadTeam: true,
  canInvite: true,
  canRevokeInvitations: true,
  canAssignRoles: true,
  canRemoveMembers: true,
  canManageRoles: true,
}

function holdsInstitutionWide(permissions: readonly EffectivePermission[], key: PermissionKey): boolean {
  return permissions.some((permission) => permission.key === key && permission.scope === 'institution')
}

/**
 * Capacidades de gestão de um vínculo a partir das concessões somadas. Espelha as
 * exigências das rotas (convite pede também `role.assign`); nome de papel nunca entra.
 */
export function getMembershipCapabilities(permissions: readonly EffectivePermission[]): StaffCapabilities {
  const holds = (key: PermissionKey): boolean => holdsInstitutionWide(permissions, key)
  // Toda escrita começa por uma leitura da lista; sem `membership.read` não há tela onde agir.
  const canReadTeam = holds('membership.read')
  return {
    canReadTeam,
    canInvite: canReadTeam && holds('membership.invite') && holds('role.assign'),
    canRevokeInvitations: canReadTeam && holds('membership.invite'),
    canAssignRoles: canReadTeam && holds('role.assign'),
    canRemoveMembers: canReadTeam && holds('membership.remove'),
    canManageRoles: canReadTeam && holds('role.manage'),
  }
}

/** Capacidades do contexto de gestão; a plataforma recebe todas e o servidor a limita. */
export function getStaffCapabilities(context: StaffManagementContext): StaffCapabilities {
  return context.kind === 'platform' ? PLATFORM_CAPABILITIES : getMembershipCapabilities(context.permissions)
}

/** Seções da Gestão, na ordem em que aparecem. */
export const MANAGEMENT_SECTIONS = ['team', 'invitations', 'roles'] as const
export type ManagementSection = (typeof MANAGEMENT_SECTIONS)[number]

/**
 * Seções que a pessoa pode abrir. As três dependem da mesma leitura (`membership.read`
 * lista equipe, convites e papéis); o que muda entre perfis são as ações dentro delas.
 */
export function listManagementSections(capabilities: StaffCapabilities): readonly ManagementSection[] {
  return capabilities.canReadTeam ? MANAGEMENT_SECTIONS : []
}

/**
 * Se a concessão pedida cabe no limite do ator. Plataforma não é comparada com
 * concessões de tenant; a resposta final é sempre do servidor.
 */
export function canDelegateGrants(context: StaffManagementContext, grants: readonly EffectivePermission[]): boolean {
  return context.kind === 'platform' || coversAllGrants(context.permissions, grants)
}

/**
 * Chave de i18n de cada bundle, tipada para o `t()` dos apps. O catálogo do core guarda a
 * mesma chave como texto; o teste do pacote impede que as duas divirjam.
 */
export const ROLE_BUNDLE_LABEL_KEYS = {
  'team-read': 'roleBundles.teamRead',
  'team-invite': 'roleBundles.teamInvite',
  'role-assign': 'roleBundles.roleAssign',
  'member-remove': 'roleBundles.memberRemove',
  'role-customize': 'roleBundles.roleCustomize',
  'student-create': 'roleBundles.studentCreate',
  'student-read': 'roleBundles.studentRead',
  'student-update': 'roleBundles.studentUpdate',
  'guardian-link': 'roleBundles.guardianLink',
  'guardian-unlink': 'roleBundles.guardianUnlink',
  'assignment-manage': 'roleBundles.assignmentManage',
  'record-read': 'roleBundles.recordRead',
  'record-write': 'roleBundles.recordWrite',
  'routine-read': 'roleBundles.routineRead',
  'routine-write': 'roleBundles.routineWrite',
} as const satisfies Readonly<Record<RoleBundleKey, `roleBundles.${string}`>>

/**
 * Falhas que as telas de gestão sabem explicar. Os códigos do contrato passam adiante
 * como estão; `network` e `server` separam "não chegou" de "chegou e falhou".
 */
export const STAFF_FAILURES = [
  'network',
  'server',
  'unauthenticated',
  'forbidden',
  'invalid-input',
  'not-found',
  'member-not-found',
  'membership-already-removed',
  'role-not-found',
  'invalid-role-for-environment',
  'grant-exceeds-authority',
  'last-team-manager',
  'system-role-immutable',
  'role-in-use',
  'invalid-role-bundles',
  'configuration-conflict',
  'invitation-authority-lost',
  'already-member',
  'invitation-not-found',
  'invitation-already-accepted',
  'invitation-revoked',
  'invitation-expired',
] as const
export type StaffFailure = (typeof STAFF_FAILURES)[number]

/**
 * Único tradutor de erro de transporte para falha de gestão. Só lê `code` e `status`;
 * texto de erro do servidor nunca chega à tela.
 */
export function toStaffFailure(error: unknown): StaffFailure {
  if (typeof error !== 'object' || error === null) return 'network'
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
  if (code === 'invalid_input') return 'invalid-input'
  if (code === 'not_found') return 'not-found'
  const known = STAFF_FAILURES.find((candidate) => candidate === code)
  if (known !== undefined) return known
  if ('status' in error && typeof error.status === 'number') return 'server'
  return 'network'
}

/** Falha que indica que o acesso mudou: o contexto de sessão precisa ser revalidado. */
export function isAccessFailure(failure: StaffFailure): boolean {
  return failure === 'forbidden' || failure === 'unauthenticated'
}

/**
 * Membro como as duas superfícies o entregam. A contagem de alunos acompanhados é do
 * alcance institucional: a plataforma não a recebe, então a tela não pode depender dela.
 */
export type StaffMemberDetail = Omit<StaffMember, 'activeStudentCount'>
export type StaffMemberSummary = Omit<StaffMemberDetail, 'version'>
export type StaffInvitationStatus = Invitation['state']['status']

/** Papel como opção de escolha, com o limite do ator já aplicado. */
export type RoleOption = Readonly<{
  role: StaffRole
  isSelected: boolean
  isDelegable: boolean
}>

export type StaffListState<Item> =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: StaffFailure }>
  | Readonly<{ status: 'empty' }>
  | Readonly<{ status: 'no-results' }>
  | Readonly<{ status: 'ready'; items: readonly Item[]; page: number; pageCount: number; total: number }>

export type StaffEnvironmentFilter = 'all' | StaffEnvironment
export type StaffInvitationFilter = 'all' | StaffInvitationStatus

export type Pagination = Readonly<{
  hasPreviousPage: boolean
  hasNextPage: boolean
  goToPreviousPage: () => void
  goToNextPage: () => void
}>

export type TeamView = Readonly<{
  state: StaffListState<StaffMemberSummary>
  capabilities: StaffCapabilities
  searchDraft: string
  setSearchDraft: (value: string) => void
  applySearch: () => void
  clearSearch: () => void
  hasActiveFilters: boolean
  environmentFilter: StaffEnvironmentFilter
  setEnvironmentFilter: (value: string) => void
  pagination: Pagination
  retry: () => void
}>

/**
 * Estado da escrita de um membro. As ações de escrita também devolvem a operação em que
 * terminaram — ou `undefined` quando nada foi enviado —, para a borda reagir ao resultado
 * (um aviso passageiro, por exemplo) sem observar o estado.
 */
export type MemberOperation =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'saving' }>
  | Readonly<{ status: 'saved' }>
  | Readonly<{ status: 'confirming-removal' }>
  | Readonly<{ status: 'removing' }>
  | Readonly<{ status: 'removed' }>
  | Readonly<{ status: 'failed'; failure: StaffFailure }>

export type MemberEditorState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: StaffFailure }>
  | Readonly<{
      status: 'ready'
      member: StaffMemberDetail
      roleOptions: readonly RoleOption[]
      isSelf: boolean
      isDirty: boolean
      canEditRoles: boolean
      canRemove: boolean
    }>

export type MemberEditor = Readonly<{
  state: MemberEditorState
  operation: MemberOperation
  roleError: 'choose-role' | undefined
  setRoleSelected: (roleId: RoleId, isSelected: boolean) => void
  save: () => Promise<MemberOperation | undefined>
  requestRemoval: () => void
  cancel: () => void
  confirmRemoval: () => Promise<MemberOperation | undefined>
  reload: () => void
}>

export type InvitationItem = Readonly<{ invitation: Invitation; roles: readonly StaffRole[] }>

export type InvitationOperation =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'confirming-revocation'; invitationId: InvitationId }>
  | Readonly<{ status: 'confirming-resend'; invitationId: InvitationId }>
  | Readonly<{ status: 'revoking'; invitationId: InvitationId }>
  | Readonly<{ status: 'resending'; invitationId: InvitationId }>
  | Readonly<{ status: 'revoked'; email: string }>
  | Readonly<{ status: 'resent'; email: string; inviteUrl: string }>
  | Readonly<{ status: 'failed'; failure: StaffFailure }>

export type InvitationsView = Readonly<{
  state: StaffListState<InvitationItem>
  capabilities: StaffCapabilities
  statusFilter: StaffInvitationFilter
  setStatusFilter: (value: string) => void
  pagination: Pagination
  retry: () => void
  operation: InvitationOperation
  requestRevocation: (invitationId: InvitationId) => void
  requestResend: (invitationId: InvitationId) => void
  cancel: () => void
  confirm: () => Promise<InvitationOperation | undefined>
}>

export type InvitationSubmission =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'submitting' }>
  | Readonly<{ status: 'created'; email: string; inviteUrl: string }>
  | Readonly<{ status: 'failed'; failure: StaffFailure }>

export type InvitationComposer = Readonly<{
  email: string
  emailError: FieldError | undefined
  setEmail: (value: string) => void
  leaveEmail: () => void
  environment: StaffEnvironment
  setEnvironment: (value: string) => void
  rolesState: Readonly<{ status: 'loading' }> | Readonly<{ status: 'failed'; failure: StaffFailure }> | Readonly<{ status: 'ready' }>
  roleOptions: readonly RoleOption[]
  roleError: 'choose-role' | undefined
  setRoleSelected: (roleId: RoleId, isSelected: boolean) => void
  submission: InvitationSubmission
  submit: () => Promise<void>
  startAnother: () => void
  retryRoles: () => void
}>

export type RoleSummary = Readonly<{ role: StaffRole; isEditable: boolean }>

export type RolesView = Readonly<{
  state:
    | Readonly<{ status: 'loading' }>
    | Readonly<{ status: 'failed'; failure: StaffFailure }>
    | Readonly<{ status: 'ready'; templates: readonly RoleSummary[]; custom: readonly RoleSummary[] }>
  capabilities: StaffCapabilities
  retry: () => void
}>

export type RoleEditorTarget = Readonly<{ mode: 'create' }> | Readonly<{ mode: 'edit'; roleId: RoleId }>

export type BundleScopeOption = Readonly<{ scope: PermissionScope; isSelected: boolean }>

/** Bundle oferecido ao editor; alcance só aparece como escolha quando há mais de um. */
export type BundleOption = Readonly<{
  key: RoleBundleKey
  labelKey: (typeof ROLE_BUNDLE_LABEL_KEYS)[RoleBundleKey]
  isSelected: boolean
  scopes: readonly BundleScopeOption[]
  hasScopeChoice: boolean
}>

export type RoleReadOnlyReason = 'system-role' | 'not-representable' | 'exceeds-authority' | 'no-permission'

export type RoleImpact = Readonly<{ activeMemberCount: number; pendingInvitationCount: number; revokesInvitations: boolean }>

export type RoleOperation =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'confirming-impact'; impact: RoleImpact }>
  | Readonly<{ status: 'saving' }>
  | Readonly<{ status: 'saved'; role: StaffRole; revokedInvitationCount: number }>
  | Readonly<{ status: 'confirming-deletion' }>
  | Readonly<{ status: 'deleting' }>
  | Readonly<{ status: 'deleted' }>
  | Readonly<{ status: 'failed'; failure: StaffFailure }>

export type RoleEditorState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: StaffFailure }>
  | Readonly<{
      status: 'ready'
      mode: RoleEditorTarget['mode']
      role: StaffRole | undefined
      templates: readonly StaffRole[]
      templateRoleId: RoleId | undefined
      environment: StaffEnvironment | undefined
      bundleOptions: readonly BundleOption[]
      readOnlyReason: RoleReadOnlyReason | undefined
      canDelete: boolean
    }>

export type RoleEditor = Readonly<{
  state: RoleEditorState
  operation: RoleOperation
  name: string
  nameError: FieldError | undefined
  setName: (value: string) => void
  leaveName: () => void
  bundlesError: 'choose-bundle' | undefined
  chooseTemplate: (roleId: string) => void
  setBundleSelected: (key: RoleBundleKey, isSelected: boolean) => void
  chooseScope: (key: RoleBundleKey, scope: PermissionScope) => void
  save: () => Promise<RoleOperation | undefined>
  confirmSave: () => Promise<RoleOperation | undefined>
  requestDeletion: () => void
  cancel: () => void
  confirmDeletion: () => Promise<RoleOperation | undefined>
  reload: () => void
}>

