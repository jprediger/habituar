import type { MembershipContext } from '@habituar/core/auth/context'
import type { ClassDetail, ClassSummary } from '@habituar/core/classes'
import type { ClassId, InstitutionId, MembershipId, StudentId } from '@habituar/core/identity/ids'
import type { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { ApiClient } from './api-client.js'
import { queryKeys } from './query-keys.js'
import { readFailureCode } from './request-failure.js'

export type ClassFailure = 'forbidden' | 'not-found' | 'conflict' | 'failed'
export type ClassListState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: ClassFailure }>
  | Readonly<{ status: 'ready'; items: readonly ClassSummary[] }>
export type ClassDetailState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: ClassFailure }>
  | Readonly<{ status: 'ready'; detail: ClassDetail }>

type ClassStudentOption = Readonly<{ id: StudentId; name: string }>
type ClassStaffOption = Readonly<{ id: MembershipId; name: string; environment: 'professional' | 'monitor' }>
export type ClassCandidatesState<Item> =
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'ready'; items: readonly Item[] }>

export type ClassCapabilities = Readonly<{
  canRead: boolean
  canCreate: boolean
  canManage: boolean
  canReadStudents: boolean
  canReadStaff: boolean
}>

export function getClassCapabilities(membership: MembershipContext): ClassCapabilities {
  const allowed = (key: 'class.read' | 'class.create' | 'class.manage' | 'student.read' | 'membership.read', scope?: 'institution') =>
    membership.permissions.some(permission => permission.key === key && (scope === undefined ? permission.scope !== 'own' : permission.scope === scope))
  return {
    canRead: allowed('class.read'),
    canCreate: allowed('class.create', 'institution'),
    canManage: allowed('class.manage', 'institution'),
    canReadStudents: allowed('student.read'),
    canReadStaff: allowed('membership.read', 'institution'),
  }
}

export type ClassHooks = Readonly<{
  useClasses(membership: MembershipContext, archived: boolean): Readonly<{ state: ClassListState; refresh(): Promise<void> }>
  useClassDetail(membership: MembershipContext, classId?: ClassId): Readonly<{ state: ClassDetailState; refresh(): Promise<void> }>
  useClassCandidates(membership: MembershipContext, enabled?: boolean): Readonly<{
    students: ClassCandidatesState<ClassStudentOption>
    staff: ClassCandidatesState<ClassStaffOption>
  }>
  useClassActions(membership: MembershipContext): Readonly<{
    pending: boolean
    failure: ClassFailure | undefined
    create(name: string, description: string | null): Promise<ClassDetail>
    update(classId: ClassId, expectedVersion: number, name: string, description: string | null): Promise<ClassDetail>
    archive(classId: ClassId, expectedVersion: number): Promise<ClassDetail>
    unarchive(classId: ClassId, expectedVersion: number): Promise<ClassDetail>
    enrollStudent(classId: ClassId, studentId: StudentId): Promise<ClassDetail>
    removeStudent(classId: ClassId, studentId: StudentId): Promise<ClassDetail>
    assignStaff(classId: ClassId, membershipId: MembershipId): Promise<ClassDetail>
    removeStaff(classId: ClassId, membershipId: MembershipId): Promise<ClassDetail>
  }>
}>

function toFailure(error: unknown): ClassFailure {
  const code = readFailureCode(error)
  if (code === 'forbidden' || code === 'unauthenticated') return 'forbidden'
  if (code === 'class-not-found' || code === 'not_found') return 'not-found'
  if (code === 'configuration-conflict' || code === 'class-archived' || code === 'class-conflict' || code === 'conflict') return 'conflict'
  return 'failed'
}

async function allPages<Item>(fetchPage: (page: number) => Promise<Readonly<{ items: readonly Item[]; total: number }>>): Promise<readonly Item[]> {
  const first = await fetchPage(1)
  const items = [...first.items]
  for (let page = 2; items.length < first.total; page++) {
    const next = await fetchPage(page)
    if (next.items.length === 0) break
    items.push(...next.items)
  }
  return items
}

/** Cache de turmas por instituição e concessões, compartilhado entre os dois clientes. */
export function createClassHooks({ apiClient, queryClient }: Readonly<{ apiClient: ApiClient; queryClient: QueryClient }>): ClassHooks {
  function useClasses(membership: MembershipContext, archived: boolean) {
    const institutionId = membership.institution.id
    const capabilities = getClassCapabilities(membership)
    const scopes = membership.permissions.filter(permission => permission.key === 'class.read').map(permission => permission.scope).sort().join(',')
    const query = useQuery({
      queryKey: [...queryKeys.institutionClasses(institutionId), 'list', archived, scopes],
      queryFn: () => apiClient.classes.list({ institutionId, archived }),
      enabled: capabilities.canRead,
      retry: false,
    }, queryClient)
    const state: ClassListState = !capabilities.canRead
      ? { status: 'failed', failure: 'forbidden' }
      : query.isError ? { status: 'failed', failure: toFailure(query.error) }
        : query.data === undefined ? { status: 'loading' }
          : { status: 'ready', items: query.data }
    return { state, async refresh() { if (capabilities.canRead) await query.refetch() } }
  }

  function useClassDetail(membership: MembershipContext, classId?: ClassId) {
    const institutionId = membership.institution.id
    const canRead = getClassCapabilities(membership).canRead
    const scopes = membership.permissions.filter(permission => permission.key === 'class.read').map(permission => permission.scope).sort().join(',')
    const query = useQuery({
      queryKey: [...queryKeys.institutionClasses(institutionId), 'detail', classId ?? 'none', scopes],
      queryFn: () => {
        if (classId === undefined) throw new Error('Class ID required.')
        return apiClient.classes.get({ institutionId, classId })
      },
      enabled: canRead && classId !== undefined,
      retry: false,
    }, queryClient)
    const state: ClassDetailState = classId === undefined ? { status: 'idle' }
      : !canRead ? { status: 'failed', failure: 'forbidden' }
        : query.isError ? { status: 'failed', failure: toFailure(query.error) }
          : query.data === undefined ? { status: 'loading' }
            : { status: 'ready', detail: query.data }
    return { state, async refresh() { if (canRead && classId !== undefined) await query.refetch() } }
  }

  function useClassCandidates(membership: MembershipContext, enabled = true) {
    const institutionId = membership.institution.id
    const capabilities = getClassCapabilities(membership)
    const canLoadStudents = enabled && capabilities.canManage && capabilities.canReadStudents
    const canLoadStaff = enabled && capabilities.canManage && capabilities.canReadStaff
    const studentScopes = membership.permissions.filter(permission => permission.key === 'student.read').map(permission => permission.scope).sort().join(',')
    const staffScopes = membership.permissions.filter(permission => permission.key === 'membership.read').map(permission => permission.scope).sort().join(',')
    const students = useQuery({
      queryKey: [...queryKeys.institutionStudents(institutionId), 'class-candidates', studentScopes],
      queryFn: async (): Promise<readonly ClassStudentOption[]> => {
        const items = await allPages(page => apiClient.students.list({ institutionId, page, pageSize: 50 }))
        return items.map(student => ({ id: student.id, name: student.socialName ?? student.fullName }))
      },
      enabled: canLoadStudents,
      retry: false,
    }, queryClient)
    const staff = useQuery({
      queryKey: [...queryKeys.institutionStaff(institutionId), 'class-candidates', staffScopes],
      queryFn: async (): Promise<readonly ClassStaffOption[]> => {
        const items = await allPages(page => apiClient.staff.listMembers({ institutionId, page, pageSize: 50 }))
        return items.map(member => ({ id: member.id, name: member.user.name, environment: member.environment }))
      },
      enabled: canLoadStaff,
      retry: false,
    }, queryClient)
    function result<Item>(enabled: boolean, pending: boolean, error: boolean, items?: readonly Item[]): ClassCandidatesState<Item> {
      if (!enabled) return { status: 'unavailable' }
      if (pending) return { status: 'loading' }
      if (error || items === undefined) return { status: 'failed' }
      return { status: 'ready', items }
    }
    return {
      students: result(canLoadStudents, students.isPending, students.isError, students.data),
      staff: result(canLoadStaff, staff.isPending, staff.isError, staff.data),
    }
  }

  function useClassActions(membership: MembershipContext) {
    const institutionId: InstitutionId = membership.institution.id
    const capabilities = getClassCapabilities(membership)
    const [pending, setPending] = useState(false)
    const [failure, setFailure] = useState<ClassFailure | undefined>()
    async function run(operation: () => Promise<ClassDetail>, allowed: boolean): Promise<ClassDetail> {
      if (!allowed) throw new Error('Class operation not permitted.')
      setPending(true)
      setFailure(undefined)
      try {
        const result = await operation()
        await queryClient.invalidateQueries({ queryKey: queryKeys.institutionClasses(institutionId) })
        return result
      } catch (error) {
        setFailure(toFailure(error))
        throw error
      } finally {
        setPending(false)
      }
    }
    return {
      pending, failure,
      create: (name: string, description: string | null) => run(() => apiClient.classes.create({ institutionId, name, description }), capabilities.canCreate),
      update: (classId: ClassId, expectedVersion: number, name: string, description: string | null) => run(() => apiClient.classes.update({ institutionId, classId, expectedVersion, name, description }), capabilities.canManage),
      archive: (classId: ClassId, expectedVersion: number) => run(() => apiClient.classes.archive({ institutionId, classId, expectedVersion }), capabilities.canManage),
      unarchive: (classId: ClassId, expectedVersion: number) => run(() => apiClient.classes.unarchive({ institutionId, classId, expectedVersion }), capabilities.canManage),
      enrollStudent: (classId: ClassId, studentId: StudentId) => run(() => apiClient.classes.enrollStudent({ institutionId, classId, studentId }), capabilities.canManage),
      removeStudent: (classId: ClassId, studentId: StudentId) => run(() => apiClient.classes.removeStudent({ institutionId, classId, studentId }), capabilities.canManage),
      assignStaff: (classId: ClassId, membershipId: MembershipId) => run(() => apiClient.classes.assignStaff({ institutionId, classId, membershipId }), capabilities.canManage),
      removeStaff: (classId: ClassId, membershipId: MembershipId) => run(() => apiClient.classes.removeStaff({ institutionId, classId, membershipId }), capabilities.canManage),
    }
  }

  return { useClasses, useClassDetail, useClassCandidates, useClassActions }
}
