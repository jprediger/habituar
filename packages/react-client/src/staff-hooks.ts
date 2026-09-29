import type { EffectivePermission } from '@habituar/core/auth/context'
import type { InvitationId, MembershipId, RoleId, UserId } from '@habituar/core/identity/ids'
import { createInvitationInputSchema } from '@habituar/core/invitations'
import type { PermissionScope } from '@habituar/core/permissions'
import type { RoleBundleCatalogEntry, RoleBundleKey, RoleBundleSelection } from '@habituar/core/role-bundles'
import { createRoleInputSchema, staffEnvironmentSchema } from '@habituar/core/staff'
import type { StaffEnvironment, StaffMember, StaffRole } from '@habituar/core/staff'
import type { QueryClient, UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import type { ApiClient } from './api-client.js'
import { getFieldErrors } from './form.js'
import {
  ROLE_BUNDLE_LABEL_KEYS,
  canDelegateGrants,
  getStaffCapabilities,
  isAccessFailure,
  toStaffFailure,
} from './staff-management.js'
import type {
  BundleOption,
  InvitationComposer,
  InvitationItem,
  InvitationOperation,
  InvitationSubmission,
  InvitationsView,
  MemberEditor,
  MemberOperation,
  Pagination,
  RoleEditor,
  RoleEditorTarget,
  RoleImpact,
  RoleOperation,
  RoleOption,
  RoleReadOnlyReason,
  RolesView,
  StaffEnvironmentFilter,
  StaffInvitationFilter,
  StaffListState,
  StaffManagementContext,
  TeamView,
} from './staff-management.js'
import { createStaffTransport } from './staff-transport.js'
import type { StaffPage, StaffTransport } from './staff-transport.js'

type StaffHookDependencies = Readonly<{
  apiClient: ApiClient
  queryClient: QueryClient
  revalidateAccess: () => Promise<void>
  useCurrentUserId: () => UserId | undefined
}>

export type StaffHooks = Readonly<{
  useTeam: (context: StaffManagementContext) => TeamView
  useTeamMember: (context: StaffManagementContext, membershipId: MembershipId) => MemberEditor
  useInvitations: (context: StaffManagementContext) => InvitationsView
  useInvitationComposer: (context: StaffManagementContext) => InvitationComposer
  useRoles: (context: StaffManagementContext) => RolesView
  useRoleEditor: (context: StaffManagementContext, target: RoleEditorTarget) => RoleEditor
}>

const emailSchema = z.object({ email: createInvitationInputSchema.shape.email })
const roleNameSchema = z.object({ name: createRoleInputSchema.shape.name })

function toContextScope(context: StaffManagementContext): string {
  return `${context.kind}:${context.institutionId}`
}

/**
 * Estado local que pertence a um contexto (instituição ou plataforma + instituição).
 * Trocar de contexto devolve o valor inicial, e uma resposta que chega depois da troca
 * carrega o contexto em que foi pedida: ela é descartada em vez de repovoar a tela nova.
 */
function useScopedState<Value>(scope: string, initial: Value): readonly [Value, (origin: string, next: (current: Value) => Value) => void] {
  const [stored, setStored] = useState<Readonly<{ scope: string; value: Value }>>({ scope, value: initial })
  const latestScope = useRef(scope)
  useEffect(() => {
    latestScope.current = scope
  }, [scope])
  const value = stored.scope === scope ? stored.value : initial

  function update(origin: string, next: (current: Value) => Value): void {
    if (origin !== latestScope.current) return
    setStored((current) => ({ scope: origin, value: next(current.scope === origin ? current.value : initial) }))
  }

  return [value, update]
}

/**
 * Trava de envio por contexto. Ref e não estado: dois toques no mesmo quadro veem o mesmo
 * estado renderizado, e só a ref impede que o segundo repita a escrita.
 */
function useSubmissionLock(): Readonly<{ acquire: (scope: string) => boolean; release: (scope: string) => void }> {
  const busyScope = useRef<string | undefined>(undefined)
  return {
    acquire: (scope) => {
      if (busyScope.current === scope) return false
      busyScope.current = scope
      return true
    },
    release: (scope) => {
      if (busyScope.current === scope) busyScope.current = undefined
    },
  }
}

function toListState<Item>(query: UseQueryResult<StaffPage<Item>>, hasActiveFilters: boolean): StaffListState<Item> {
  if (query.isPending) return { status: 'loading' }
  if (query.isError) return { status: 'failed', failure: toStaffFailure(query.error) }
  const page = query.data
  if (page.total === 0) return hasActiveFilters ? { status: 'no-results' } : { status: 'empty' }
  return { status: 'ready', items: page.items, page: page.page, pageCount: Math.max(1, Math.ceil(page.total / page.pageSize)), total: page.total }
}

function toPagination(state: StaffListState<unknown>, goToPage: (page: number) => void): Pagination {
  const page = state.status === 'ready' ? state.page : 1
  const pageCount = state.status === 'ready' ? state.pageCount : 1
  return {
    hasPreviousPage: page > 1,
    hasNextPage: page < pageCount,
    goToPreviousPage: () => { if (page > 1) goToPage(page - 1) },
    goToNextPage: () => { if (page < pageCount) goToPage(page + 1) },
  }
}

function isStaffRole(role: StaffRole): boolean {
  return role.environment === 'professional' || role.environment === 'monitor'
}

function toStaffEnvironment(role: StaffRole | undefined): StaffEnvironment | undefined {
  const parsed = staffEnvironmentSchema.safeParse(role?.environment)
  return parsed.success ? parsed.data : undefined
}

function bundleGrants(entry: RoleBundleCatalogEntry, scope: PermissionScope): readonly EffectivePermission[] {
  return entry.permissions.map((key) => ({ key, scope }))
}

function toSelectionKeys(selections: readonly RoleBundleSelection[]): ReadonlySet<string> {
  return new Set(selections.map((selection) => `${selection.bundle}@${selection.scope}`))
}

function hasSameSelections(first: readonly RoleBundleSelection[], second: readonly RoleBundleSelection[]): boolean {
  const firstKeys = toSelectionKeys(first)
  const secondKeys = toSelectionKeys(second)
  return firstKeys.size === secondKeys.size && [...firstKeys].every((key) => secondKeys.has(key))
}

function hasSameRoleIds(first: readonly RoleId[], second: readonly RoleId[]): boolean {
  return first.length === second.length && first.every((roleId) => second.includes(roleId))
}

type TeamFilters = Readonly<{ searchDraft: string; search: string | undefined; environment: StaffEnvironmentFilter; page: number }>
const INITIAL_TEAM_FILTERS: TeamFilters = { searchDraft: '', search: undefined, environment: 'all', page: 1 }

type InvitationFilters = Readonly<{ status: StaffInvitationFilter; page: number }>
const INITIAL_INVITATION_FILTERS: InvitationFilters = { status: 'all', page: 1 }
const INVITATION_FILTERS: readonly StaffInvitationFilter[] = ['all', 'pending', 'accepted', 'revoked', 'expired']

type ComposerDraft = Readonly<{
  email: string
  isEmailVisited: boolean
  hasAttemptedSubmit: boolean
  environment: StaffEnvironment
  roleIds: readonly RoleId[]
  submission: InvitationSubmission
}>
const INITIAL_COMPOSER: ComposerDraft = { email: '', isEmailVisited: false, hasAttemptedSubmit: false, environment: 'professional', roleIds: [], submission: { status: 'idle' } }

type MemberDraft = Readonly<{ roleIds: readonly RoleId[] | undefined; roleError: 'choose-role' | undefined; operation: MemberOperation }>
const INITIAL_MEMBER_DRAFT: MemberDraft = { roleIds: undefined, roleError: undefined, operation: { status: 'idle' } }

type RoleDraft = Readonly<{
  name: string | undefined
  isNameVisited: boolean
  hasAttemptedSubmit: boolean
  templateRoleId: RoleId | undefined
  bundles: readonly RoleBundleSelection[] | undefined
  operation: RoleOperation
}>
const INITIAL_ROLE_DRAFT: RoleDraft = { name: undefined, isNameVisited: false, hasAttemptedSubmit: false, templateRoleId: undefined, bundles: undefined, operation: { status: 'idle' } }

/**
 * Hooks de equipe, convites e papéis, compartilhados por web e mobile e pelas duas áreas
 * (instituição e plataforma). Donos da escolha de transporte, das chaves de query, da
 * invalidação depois de cada escrita, da trava contra envio duplicado e da tradução de
 * falha; recusam sucesso otimista, porque autorização só muda quando o servidor confirma.
 */
export function createStaffHooks(dependencies: StaffHookDependencies): StaffHooks {
  const { apiClient, queryClient, revalidateAccess, useCurrentUserId } = dependencies

  // Negativa de acesso não é só falha desta tela: o vínculo ou a permissão podem ter
  // mudado, e o contexto da sessão precisa ser relido para a navegação acompanhar.
  async function guard<Value>(operation: () => Promise<Value>): Promise<Value> {
    try {
      return await operation()
    } catch (error) {
      if (isAccessFailure(toStaffFailure(error))) void revalidateAccess()
      throw error
    }
  }

  async function afterWrite(transport: StaffTransport, context: StaffManagementContext, isAccessAffected: boolean): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: transport.invalidationScope })
    if (context.kind === 'institution' && isAccessAffected) await revalidateAccess()
  }

  function useRolesQuery(transport: StaffTransport): UseQueryResult<readonly StaffRole[]> {
    return useQuery({ queryKey: [...transport.queryScope, 'roles'], queryFn: () => guard(transport.listRoles), retry: false }, queryClient)
  }

  function useTeam(context: StaffManagementContext): TeamView {
    const scope = toContextScope(context)
    const transport = createStaffTransport(apiClient, context)
    const [filters, updateFilters] = useScopedState(scope, INITIAL_TEAM_FILTERS)
    const environment = filters.environment === 'all' ? undefined : filters.environment
    const query = useQuery(
      {
        queryKey: [...transport.queryScope, 'members', { search: filters.search, environment, page: filters.page }],
        queryFn: () => guard(() => transport.listMembers({ search: filters.search, environment, page: filters.page })),
        retry: false,
      },
      queryClient,
    )
    const hasActiveFilters = filters.search !== undefined || environment !== undefined
    const state = toListState(query, hasActiveFilters)

    return {
      state,
      capabilities: getStaffCapabilities(context),
      searchDraft: filters.searchDraft,
      setSearchDraft: (value) => { updateFilters(scope, (current) => ({ ...current, searchDraft: value })) },
      applySearch: () => {
        updateFilters(scope, (current) => {
          const search = current.searchDraft.trim().slice(0, 200)
          return { ...current, search: search === '' ? undefined : search, page: 1 }
        })
      },
      clearSearch: () => { updateFilters(scope, (current) => ({ ...current, searchDraft: '', search: undefined, page: 1 })) },
      hasActiveFilters,
      environmentFilter: filters.environment,
      setEnvironmentFilter: (value) => {
        const parsed = staffEnvironmentSchema.safeParse(value)
        const next: StaffEnvironmentFilter = parsed.success ? parsed.data : 'all'
        updateFilters(scope, (current) => ({ ...current, environment: next, page: 1 }))
      },
      pagination: toPagination(state, (page) => { updateFilters(scope, (current) => ({ ...current, page })) }),
      retry: () => { void query.refetch() },
    }
  }

  function useTeamMember(context: StaffManagementContext, membershipId: MembershipId): MemberEditor {
    const scope = `${toContextScope(context)}:${membershipId}`
    const transport = createStaffTransport(apiClient, context)
    const capabilities = getStaffCapabilities(context)
    const currentUserId = useCurrentUserId()
    const memberQuery = useQuery({ queryKey: [...transport.queryScope, 'member', membershipId], queryFn: () => guard(() => transport.getMember(membershipId)), retry: false }, queryClient)
    const rolesQuery = useRolesQuery(transport)
    const [draft, updateDraft] = useScopedState(scope, INITIAL_MEMBER_DRAFT)
    const lock = useSubmissionLock()
    const member = memberQuery.data
    const currentRoleIds = member?.roles.map((role) => role.id) ?? []
    const selectedRoleIds = draft.roleIds ?? currentRoleIds

    function buildState(): MemberEditor['state'] {
      if (memberQuery.isError) return { status: 'failed', failure: toStaffFailure(memberQuery.error) }
      if (rolesQuery.isError) return { status: 'failed', failure: toStaffFailure(rolesQuery.error) }
      if (member === undefined || rolesQuery.data === undefined) return { status: 'loading' }
      const roleOptions: RoleOption[] = rolesQuery.data
        .filter((role) => role.environment === member.environment)
        .map((role) => ({ role, isSelected: selectedRoleIds.includes(role.id), isDelegable: canDelegateGrants(context, role.grants) }))
      return {
        status: 'ready',
        member,
        roleOptions,
        isSelf: member.user.id === currentUserId,
        isDirty: !hasSameRoleIds(selectedRoleIds, currentRoleIds),
        canEditRoles: capabilities.canAssignRoles,
        canRemove: capabilities.canRemoveMembers,
      }
    }

    const state = buildState()
    const setOperation = (origin: string, operation: MemberOperation): void => { updateDraft(origin, (current) => ({ ...current, operation })) }

    async function runWrite(origin: string, loaded: StaffMember, pending: MemberOperation, done: MemberOperation, write: () => Promise<unknown>): Promise<void> {
      if (!lock.acquire(origin)) return
      setOperation(origin, pending)
      try {
        await guard(write)
        await afterWrite(transport, context, loaded.user.id === currentUserId)
        updateDraft(origin, () => ({ ...INITIAL_MEMBER_DRAFT, operation: done }))
      } catch (error) {
        setOperation(origin, { status: 'failed', failure: toStaffFailure(error) })
      } finally {
        lock.release(origin)
      }
    }

    return {
      state,
      operation: draft.operation,
      roleError: draft.roleError,
      setRoleSelected: (roleId, isSelected) => {
        if (state.status !== 'ready') return
        const option = state.roleOptions.find((candidate) => candidate.role.id === roleId)
        if (option === undefined || !option.isDelegable) return
        const next = isSelected ? [...selectedRoleIds.filter((id) => id !== roleId), roleId] : selectedRoleIds.filter((id) => id !== roleId)
        updateDraft(scope, (current) => ({ ...current, roleIds: next, roleError: undefined, operation: { status: 'idle' } }))
      },
      save: async () => {
        if (member === undefined || !capabilities.canAssignRoles) return
        if (selectedRoleIds.length === 0) {
          updateDraft(scope, (current) => ({ ...current, roleError: 'choose-role' }))
          return
        }
        const roleIds = selectedRoleIds
        await runWrite(scope, member, { status: 'saving' }, { status: 'saved' }, () => transport.replaceMemberRoles({ membershipId, roleIds, expectedVersion: member.version }))
      },
      requestRemoval: () => { if (capabilities.canRemoveMembers) setOperation(scope, { status: 'confirming-removal' }) },
      cancel: () => { setOperation(scope, { status: 'idle' }) },
      confirmRemoval: async () => {
        if (member === undefined || draft.operation.status !== 'confirming-removal') return
        await runWrite(scope, member, { status: 'removing' }, { status: 'removed' }, () => transport.removeMember({ membershipId, expectedVersion: member.version }))
      },
      reload: () => {
        updateDraft(scope, () => INITIAL_MEMBER_DRAFT)
        void queryClient.invalidateQueries({ queryKey: [...transport.queryScope, 'member', membershipId] })
        void queryClient.invalidateQueries({ queryKey: [...transport.queryScope, 'roles'] })
      },
    }
  }

  function useInvitations(context: StaffManagementContext): InvitationsView {
    const scope = toContextScope(context)
    const transport = createStaffTransport(apiClient, context)
    const [filters, updateFilters] = useScopedState(scope, INITIAL_INVITATION_FILTERS)
    const [operation, updateOperation] = useScopedState<InvitationOperation>(scope, { status: 'idle' })
    const lock = useSubmissionLock()
    const status = filters.status === 'all' ? undefined : filters.status
    const query = useQuery(
      {
        queryKey: [...transport.queryScope, 'invitations', { status, page: filters.page }],
        queryFn: () => guard(() => transport.listInvitations({ status, page: filters.page })),
        retry: false,
      },
      queryClient,
    )
    const rolesQuery = useRolesQuery(transport)
    const listState = toListState(query, status !== undefined)
    const roles = rolesQuery.data ?? []
    const state: StaffListState<InvitationItem> = listState.status === 'ready'
      ? { ...listState, items: listState.items.map((invitation) => ({ invitation, roles: roles.filter((role) => invitation.roleIds.includes(role.id)) })) }
      : listState

    function findEmail(invitationId: InvitationId): string {
      return query.data?.items.find((invitation) => invitation.id === invitationId)?.email ?? ''
    }

    async function runWrite(origin: string, pending: InvitationOperation, write: () => Promise<InvitationOperation>): Promise<void> {
      if (!lock.acquire(origin)) return
      updateOperation(origin, () => pending)
      try {
        const done = await guard(write)
        await afterWrite(transport, context, false)
        updateOperation(origin, () => done)
      } catch (error) {
        updateOperation(origin, () => ({ status: 'failed', failure: toStaffFailure(error) }))
      } finally {
        lock.release(origin)
      }
    }

    const capabilities = getStaffCapabilities(context)
    return {
      state,
      capabilities,
      statusFilter: filters.status,
      setStatusFilter: (value) => {
        const next = INVITATION_FILTERS.find((candidate) => candidate === value) ?? 'all'
        updateFilters(scope, () => ({ status: next, page: 1 }))
      },
      pagination: toPagination(state, (page) => { updateFilters(scope, (current) => ({ ...current, page })) }),
      retry: () => { void query.refetch(); void rolesQuery.refetch() },
      operation,
      requestRevocation: (invitationId) => { if (capabilities.canRevokeInvitations) updateOperation(scope, () => ({ status: 'confirming-revocation', invitationId })) },
      requestResend: (invitationId) => { if (capabilities.canInvite) updateOperation(scope, () => ({ status: 'confirming-resend', invitationId })) },
      cancel: () => { updateOperation(scope, () => ({ status: 'idle' })) },
      confirm: async () => {
        if (operation.status === 'confirming-revocation') {
          const { invitationId } = operation
          const email = findEmail(invitationId)
          await runWrite(scope, { status: 'revoking', invitationId }, async () => {
            await transport.revokeInvitation(invitationId)
            return { status: 'revoked', email }
          })
          return
        }
        if (operation.status === 'confirming-resend') {
          const { invitationId } = operation
          await runWrite(scope, { status: 'resending', invitationId }, async () => {
            const created = await transport.resendInvitation(invitationId)
            return { status: 'resent', email: created.invitation.email, inviteUrl: created.inviteUrl }
          })
        }
      },
    }
  }

  function useInvitationComposer(context: StaffManagementContext): InvitationComposer {
    const scope = toContextScope(context)
    const transport = createStaffTransport(apiClient, context)
    const rolesQuery = useRolesQuery(transport)
    const [draft, updateDraft] = useScopedState(scope, INITIAL_COMPOSER)
    const lock = useSubmissionLock()
    const emailError = getFieldErrors(emailSchema, { email: draft.email }).email
    const isEmailErrorVisible = draft.isEmailVisited || draft.hasAttemptedSubmit
    // A UI omite o que o ator não pode conceder; o servidor recusa de qualquer forma.
    const roleOptions: RoleOption[] = (rolesQuery.data ?? [])
      .filter((role) => role.environment === draft.environment && canDelegateGrants(context, role.grants))
      .map((role) => ({ role, isSelected: draft.roleIds.includes(role.id), isDelegable: true }))
    const selectedRoleIds = roleOptions.filter((option) => option.isSelected).map((option) => option.role.id)

    return {
      email: draft.email,
      emailError: isEmailErrorVisible ? emailError : undefined,
      setEmail: (value) => { updateDraft(scope, (current) => ({ ...current, email: value })) },
      leaveEmail: () => { updateDraft(scope, (current) => ({ ...current, isEmailVisited: true })) },
      environment: draft.environment,
      // Trocar o tipo descarta a seleção: papel de outro ambiente seria recusado pela API.
      setEnvironment: (value) => {
        const parsed = staffEnvironmentSchema.safeParse(value)
        if (parsed.success) updateDraft(scope, (current) => ({ ...current, environment: parsed.data, roleIds: [] }))
      },
      rolesState: rolesQuery.isError ? { status: 'failed', failure: toStaffFailure(rolesQuery.error) } : rolesQuery.isPending ? { status: 'loading' } : { status: 'ready' },
      roleOptions,
      roleError: draft.hasAttemptedSubmit && selectedRoleIds.length === 0 ? 'choose-role' : undefined,
      setRoleSelected: (roleId, isSelected) => {
        updateDraft(scope, (current) => ({
          ...current,
          roleIds: isSelected ? [...current.roleIds.filter((id) => id !== roleId), roleId] : current.roleIds.filter((id) => id !== roleId),
        }))
      },
      submission: draft.submission,
      submit: async () => {
        updateDraft(scope, (current) => ({ ...current, hasAttemptedSubmit: true }))
        const parsed = emailSchema.safeParse({ email: draft.email })
        if (!parsed.success || selectedRoleIds.length === 0) return
        if (!lock.acquire(scope)) return
        const input = { email: parsed.data.email, environment: draft.environment, roleIds: selectedRoleIds }
        updateDraft(scope, (current) => ({ ...current, submission: { status: 'submitting' } }))
        try {
          const created = await guard(() => transport.createInvitation(input))
          await afterWrite(transport, context, false)
          updateDraft(scope, (current) => ({ ...INITIAL_COMPOSER, environment: current.environment, submission: { status: 'created', email: created.invitation.email, inviteUrl: created.inviteUrl } }))
        } catch (error) {
          updateDraft(scope, (current) => ({ ...current, submission: { status: 'failed', failure: toStaffFailure(error) } }))
        } finally {
          lock.release(scope)
        }
      },
      startAnother: () => { updateDraft(scope, (current) => ({ ...current, submission: { status: 'idle' } })) },
      retryRoles: () => { void rolesQuery.refetch() },
    }
  }

  function useRoles(context: StaffManagementContext): RolesView {
    const transport = createStaffTransport(apiClient, context)
    const capabilities = getStaffCapabilities(context)
    const query = useRolesQuery(transport)

    function buildState(): RolesView['state'] {
      if (query.isPending) return { status: 'loading' }
      if (query.isError) return { status: 'failed', failure: toStaffFailure(query.error) }
      const summaries = query.data.filter(isStaffRole).map((role) => ({
        role,
        isEditable: !role.isSystem && capabilities.canManageRoles && role.bundles !== null && canDelegateGrants(context, role.grants),
      }))
      return {
        status: 'ready',
        templates: summaries.filter((summary) => summary.role.isSystem),
        custom: summaries.filter((summary) => !summary.role.isSystem),
      }
    }

    return { state: buildState(), capabilities, retry: () => { void query.refetch() } }
  }

  function useRoleEditor(context: StaffManagementContext, target: RoleEditorTarget): RoleEditor {
    const scope = `${toContextScope(context)}:${target.mode === 'edit' ? target.roleId : 'new'}`
    const transport = createStaffTransport(apiClient, context)
    const capabilities = getStaffCapabilities(context)
    const rolesQuery = useRolesQuery(transport)
    const bundlesQuery = useQuery({ queryKey: [...transport.queryScope, 'role-bundles'], queryFn: () => guard(transport.listRoleBundles), retry: false, staleTime: Number.POSITIVE_INFINITY }, queryClient)
    const editedRoleId = target.mode === 'edit' ? target.roleId : undefined
    const roleQuery = useQuery(
      {
        queryKey: [...transport.queryScope, 'role', editedRoleId],
        queryFn: () => guard(() => (editedRoleId === undefined ? Promise.reject(new Error('Role editor has no role to load.')) : transport.getRole(editedRoleId))),
        enabled: editedRoleId !== undefined,
        retry: false,
      },
      queryClient,
    )
    const [draft, updateDraft] = useScopedState(scope, INITIAL_ROLE_DRAFT)
    const lock = useSubmissionLock()

    const templates = (rolesQuery.data ?? []).filter((role) => role.isSystem && isStaffRole(role))
    const role = roleQuery.data
    const template = templates.find((candidate) => candidate.id === draft.templateRoleId) ?? templates[0]
    const source = target.mode === 'edit' ? role : template
    const environment = toStaffEnvironment(source)
    const catalog = bundlesQuery.data ?? []

    function readOnlyReason(): RoleReadOnlyReason | undefined {
      if (!capabilities.canManageRoles) return 'no-permission'
      if (target.mode === 'create') return undefined
      if (role === undefined) return undefined
      if (role.isSystem) return 'system-role'
      if (role.bundles === null || environment === undefined) return 'not-representable'
      if (!canDelegateGrants(context, role.grants)) return 'exceeds-authority'
      return undefined
    }
    const reason = readOnlyReason()

    function delegableScopes(entry: RoleBundleCatalogEntry): readonly PermissionScope[] {
      if (environment === undefined) return []
      const scopes = entry.scopesByEnvironment[environment]
      return reason === undefined ? scopes.filter((scope) => canDelegateGrants(context, bundleGrants(entry, scope))) : scopes
    }

    function defaultBundles(): readonly RoleBundleSelection[] {
      if (target.mode === 'edit') return role?.bundles ?? []
      // O ponto de partida é o template, recortado ao que o ator pode conceder.
      return (template?.bundles ?? []).filter((selection) => {
        const entry = catalog.find((candidate) => candidate.key === selection.bundle)
        return entry !== undefined && delegableScopes(entry).includes(selection.scope)
      })
    }

    const bundles = draft.bundles ?? defaultBundles()
    const name = draft.name ?? (target.mode === 'edit' ? role?.name ?? '' : '')
    const nameError = getFieldErrors(roleNameSchema, { name }).name
    const isNameErrorVisible = draft.isNameVisited || draft.hasAttemptedSubmit

    const bundleOptions: BundleOption[] = catalog.flatMap((entry) => {
      const scopes = delegableScopes(entry)
      if (scopes.length === 0) return []
      const selected = bundles.find((selection) => selection.bundle === entry.key)
      return [{
        key: entry.key,
        labelKey: ROLE_BUNDLE_LABEL_KEYS[entry.key],
        isSelected: selected !== undefined,
        scopes: scopes.map((scope) => ({ scope, isSelected: selected?.scope === scope })),
        hasScopeChoice: scopes.length > 1,
      }]
    })

    function buildState(): RoleEditor['state'] {
      const failedQuery = [rolesQuery, bundlesQuery, roleQuery].find((query) => query.isError)
      if (failedQuery !== undefined) return { status: 'failed', failure: toStaffFailure(failedQuery.error) }
      if (rolesQuery.data === undefined || bundlesQuery.data === undefined) return { status: 'loading' }
      if (target.mode === 'edit' && role === undefined) return { status: 'loading' }
      return {
        status: 'ready',
        mode: target.mode,
        role,
        templates,
        templateRoleId: template?.id,
        environment,
        bundleOptions,
        readOnlyReason: reason,
        canDelete: target.mode === 'edit' && reason === undefined,
      }
    }

    const state = buildState()
    const setOperation = (origin: string, operation: RoleOperation): void => { updateDraft(origin, (current) => ({ ...current, operation })) }

    async function runWrite(origin: string, pending: RoleOperation, write: () => Promise<RoleOperation>): Promise<void> {
      if (!lock.acquire(origin)) return
      setOperation(origin, pending)
      try {
        const done = await guard(write)
        await afterWrite(transport, context, true)
        updateDraft(origin, () => ({ ...INITIAL_ROLE_DRAFT, operation: done }))
      } catch (error) {
        setOperation(origin, { status: 'failed', failure: toStaffFailure(error) })
      } finally {
        lock.release(origin)
      }
    }

    function computeImpact(loaded: StaffRole): RoleImpact {
      const revokesInvitations = loaded.pendingInvitationCount > 0 && !hasSameSelections(loaded.bundles ?? [], bundles)
      return { activeMemberCount: loaded.activeMemberCount, pendingInvitationCount: loaded.pendingInvitationCount, revokesInvitations }
    }

    async function update(loaded: StaffRole, parsedName: string, impact: RoleImpact): Promise<void> {
      const selections = bundles
      await runWrite(scope, { status: 'saving' }, async () => {
        const saved = await transport.updateRole({ roleId: loaded.id, name: parsedName, bundles: selections, expectedVersion: loaded.version })
        return { status: 'saved', role: saved, revokedInvitationCount: impact.revokesInvitations ? impact.pendingInvitationCount : 0 }
      })
    }

    function parseName(): string | undefined {
      const parsed = roleNameSchema.safeParse({ name })
      return parsed.success ? parsed.data.name : undefined
    }

    return {
      state,
      operation: draft.operation,
      name,
      nameError: isNameErrorVisible ? nameError : undefined,
      setName: (value) => { updateDraft(scope, (current) => ({ ...current, name: value })) },
      leaveName: () => { updateDraft(scope, (current) => ({ ...current, isNameVisited: true })) },
      bundlesError: draft.hasAttemptedSubmit && bundles.length === 0 ? 'choose-bundle' : undefined,
      chooseTemplate: (roleId) => {
        const chosen = templates.find((candidate) => candidate.id === roleId)
        if (chosen !== undefined) updateDraft(scope, (current) => ({ ...current, templateRoleId: chosen.id, bundles: undefined }))
      },
      setBundleSelected: (key: RoleBundleKey, isSelected: boolean) => {
        if (reason !== undefined) return
        const option = bundleOptions.find((candidate) => candidate.key === key)
        const [narrowestScope] = option?.scopes ?? []
        if (option === undefined || narrowestScope === undefined) return
        // O alcance mais estreito vem marcado: o padrão seguro é o menor acesso possível.
        const next = isSelected
          ? [...bundles.filter((selection) => selection.bundle !== key), { bundle: key, scope: narrowestScope.scope }]
          : bundles.filter((selection) => selection.bundle !== key)
        updateDraft(scope, (current) => ({ ...current, bundles: next }))
      },
      chooseScope: (key, chosenScope) => {
        if (reason !== undefined) return
        const option = bundleOptions.find((candidate) => candidate.key === key)
        if (option === undefined || !option.scopes.some((candidate) => candidate.scope === chosenScope)) return
        updateDraft(scope, (current) => ({ ...current, bundles: bundles.map((selection) => (selection.bundle === key ? { bundle: key, scope: chosenScope } : selection)) }))
      },
      save: async () => {
        updateDraft(scope, (current) => ({ ...current, hasAttemptedSubmit: true }))
        const parsedName = parseName()
        if (state.status !== 'ready' || reason !== undefined || parsedName === undefined || bundles.length === 0) return
        if (target.mode === 'create') {
          if (template === undefined) return
          const templateRoleId = template.id
          const selections = bundles
          await runWrite(scope, { status: 'saving' }, async () => {
            const created = await transport.createRole({ templateRoleId, name: parsedName, bundles: selections })
            return { status: 'saved', role: created, revokedInvitationCount: 0 }
          })
          return
        }
        if (role === undefined) return
        const impact = computeImpact(role)
        // Papel com titulares muda o acesso de todos eles: a confirmação vem antes do envio.
        if (impact.activeMemberCount + impact.pendingInvitationCount > 0) {
          setOperation(scope, { status: 'confirming-impact', impact })
          return
        }
        await update(role, parsedName, impact)
      },
      confirmSave: async () => {
        const parsedName = parseName()
        if (draft.operation.status !== 'confirming-impact' || role === undefined || parsedName === undefined) return
        await update(role, parsedName, draft.operation.impact)
      },
      requestDeletion: () => { if (state.status === 'ready' && state.canDelete) setOperation(scope, { status: 'confirming-deletion' }) },
      cancel: () => { setOperation(scope, { status: 'idle' }) },
      confirmDeletion: async () => {
        if (draft.operation.status !== 'confirming-deletion' || role === undefined) return
        const loaded = role
        await runWrite(scope, { status: 'deleting' }, async () => {
          await transport.deleteRole({ roleId: loaded.id, expectedVersion: loaded.version })
          return { status: 'deleted' }
        })
      },
      reload: () => {
        updateDraft(scope, () => INITIAL_ROLE_DRAFT)
        void queryClient.invalidateQueries({ queryKey: [...transport.queryScope, 'role', editedRoleId] })
        void queryClient.invalidateQueries({ queryKey: [...transport.queryScope, 'roles'] })
      },
    }
  }

  return { useTeam, useTeamMember, useInvitations, useInvitationComposer, useRoles, useRoleEditor }
}

