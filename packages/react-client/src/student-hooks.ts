import type { InstitutionId, StudentId } from '@habituar/core/identity/ids'
import type { AddStudentGuardianInput, ConsentPath, CreateStudentInput, CreateStudentInvitationInput, RecordConsentInput, RemoveStudentGuardianInput, ReplaceAssignmentsInput, StudentDetail, StudentPage, UpdateStudentInput } from '@habituar/core/students'
import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ApiClient } from './api-client.js'
import type { PreferenceStorage } from './preference-storage.js'
import { queryKeys } from './query-keys.js'

type StudentListState = Readonly<{ status: 'loading' }> | Readonly<{ status: 'error' }> | Readonly<{ status: 'ready'; items: StudentPage['items']; total: number; page: number; pageSize: number }>
type StudentDetailState = Readonly<{ status: 'loading' }> | Readonly<{ status: 'error' }> | Readonly<{ status: 'ready'; student: StudentDetail }>
type StudentFailure = 'conflict' | 'forbidden' | 'not-found' | 'server' | 'network'
type StudentHooksDependencies = Readonly<{ apiClient: ApiClient; queryClient: QueryClient; preferenceStorage: PreferenceStorage }>

type StudentActionInput = {
  addGuardian: AddStudentGuardianInput
  removeGuardian: RemoveStudentGuardianInput
  replaceAssignments: ReplaceAssignmentsInput
  invite: CreateStudentInvitationInput
  recordConsent: RecordConsentInput
  revokeConsent: ConsentPath
}

type StudentActions = Readonly<{
  addGuardian(input: StudentActionInput['addGuardian']): ReturnType<ApiClient['students']['addGuardian']>
  removeGuardian(input: StudentActionInput['removeGuardian']): ReturnType<ApiClient['students']['removeGuardian']>
  replaceAssignments(input: StudentActionInput['replaceAssignments']): ReturnType<ApiClient['students']['replaceAssignments']>
  invite(input: StudentActionInput['invite']): ReturnType<ApiClient['students']['invite']>
  recordConsent(input: StudentActionInput['recordConsent']): ReturnType<ApiClient['students']['recordConsent']>
  getConsentDocument(input: ConsentPath): ReturnType<ApiClient['students']['getConsentDocument']>
  revokeConsent(input: StudentActionInput['revokeConsent']): ReturnType<ApiClient['students']['revokeConsent']>
  archive(): ReturnType<ApiClient['students']['archive']>
  unarchive(): ReturnType<ApiClient['students']['unarchive']>
  pending: boolean
  failure: StudentFailure | undefined
}>

export type StudentHooks = Readonly<{
  useStudentList(institutionId: InstitutionId): Readonly<{ state: StudentListState; search: string; setSearch(value: string): void; archived: boolean; setArchived(value: boolean): void; page: number; setPage(value: number): void; refresh(): Promise<void> }>
  useStudentDetail(institutionId: InstitutionId, studentId: StudentId): Readonly<{ state: StudentDetailState; refresh(): Promise<void> }>
  useStudentForm(institutionId: InstitutionId, studentId?: StudentId): Readonly<{ submit(input: CreateStudentInput | UpdateStudentInput): Promise<StudentDetail>; pending: boolean; failure: StudentFailure | undefined }>
  useStudentActions(institutionId: InstitutionId, studentId: StudentId): StudentActions
  usePendingConsents(): Readonly<{ state: Readonly<{ status: 'loading' }> | Readonly<{ status: 'error' }> | Readonly<{ status: 'ready'; items: Awaited<ReturnType<ApiClient['students']['pendingConsents']>> }>; confirm(studentId: StudentId): ReturnType<ApiClient['students']['confirmConsent']>; refresh(): Promise<void> }>
  useStudentPicker(institutionId: InstitutionId): Readonly<{ state: StudentListState; selectedStudentId: StudentId | undefined; selectStudent(studentId: StudentId): Promise<void> }>
}>

function toFailure(error: unknown): StudentFailure {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === 'configuration-conflict') return 'conflict'
    if (error.code === 'forbidden') return 'forbidden'
    if (error.code === 'student-not-found') return 'not-found'
  }
  if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') return 'server'
  return 'network'
}

/** Concentra consultas e escritas de alunos para que as plataformas recebam o mesmo estado e invalidação. */
export function createStudentHooks({ apiClient, queryClient, preferenceStorage }: StudentHooksDependencies): StudentHooks {
  async function invalidate(institutionId: InstitutionId): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: queryKeys.institutionStudents(institutionId) })
    await queryClient.invalidateQueries({ queryKey: queryKeys.institutionStaff(institutionId) })
  }

  function useStudentList(institutionId: InstitutionId) {
    const [search, setSearchValue] = useState('')
    const [archived, setArchivedValue] = useState(false)
    const [page, setPage] = useState(1)
    const normalizedSearch = search.trim()
    const query = useQuery({
      queryKey: [...queryKeys.institutionStudents(institutionId), 'list', normalizedSearch, archived, page],
      queryFn: () => apiClient.students.list({ institutionId, ...(normalizedSearch === '' ? {} : { search: normalizedSearch }), ...(archived ? { archived: true } : {}), page, pageSize: 20 }),
    }, queryClient)
    const state: StudentListState = query.isPending ? { status: 'loading' } : query.isError ? { status: 'error' } : { status: 'ready', ...query.data }
    return {
      state, search, archived, page,
      setSearch(value: string) { setSearchValue(value); setPage(1) },
      setArchived(value: boolean) { setArchivedValue(value); setPage(1) },
      setPage,
      async refresh() { await query.refetch() },
    }
  }

  function useStudentDetail(institutionId: InstitutionId, studentId: StudentId) {
    const query = useQuery({ queryKey: [...queryKeys.institutionStudents(institutionId), 'detail', studentId], queryFn: () => apiClient.students.get({ institutionId, studentId }) }, queryClient)
    const state: StudentDetailState = query.isPending ? { status: 'loading' } : query.isError ? { status: 'error' } : { status: 'ready', student: query.data }
    return { state, async refresh() { await query.refetch() } }
  }

  function useStudentForm(institutionId: InstitutionId, studentId?: StudentId) {
    const [pending, setPending] = useState(false)
    const [failure, setFailure] = useState<StudentFailure | undefined>()
    async function submit(input: CreateStudentInput | UpdateStudentInput): Promise<StudentDetail> {
      setPending(true)
      setFailure(undefined)
      try {
        let result: StudentDetail
        if (studentId === undefined) {
          result = await apiClient.students.create({ ...input, institutionId })
        } else {
          if (!('expectedVersion' in input)) throw new Error('Student update requires expectedVersion.')
          result = await apiClient.students.update({ ...input, institutionId, studentId, expectedVersion: input.expectedVersion })
        }
        await invalidate(institutionId)
        return result
      } catch (error) {
        setFailure(toFailure(error))
        throw error
      } finally { setPending(false) }
    }
    return { submit, pending, failure }
  }

  function useStudentActions(institutionId: InstitutionId, studentId: StudentId): StudentActions {
    const [pending, setPending] = useState(false)
    const [failure, setFailure] = useState<StudentFailure | undefined>()
    async function run<Result>(operation: () => Promise<Result>): Promise<Result> {
      setPending(true)
      setFailure(undefined)
      try {
        const result = await operation()
        await invalidate(institutionId)
        return result
      } catch (error) {
        setFailure(toFailure(error))
        throw error
      } finally { setPending(false) }
    }
    return {
      addGuardian: (input) => run(() => apiClient.students.addGuardian(input)),
      removeGuardian: (input) => run(() => apiClient.students.removeGuardian(input)),
      replaceAssignments: (input) => run(() => apiClient.students.replaceAssignments(input)),
      invite: (input) => run(() => apiClient.students.invite(input)),
      recordConsent: (input) => run(() => apiClient.students.recordConsent(input)),
      getConsentDocument: (input) => apiClient.students.getConsentDocument(input),
      revokeConsent: (input) => run(() => apiClient.students.revokeConsent(input)),
      archive: () => run(() => apiClient.students.archive({ institutionId, studentId })),
      unarchive: () => run(() => apiClient.students.unarchive({ institutionId, studentId })),
      pending, failure,
    }
  }

  function usePendingConsents() {
    const query = useQuery({ queryKey: [...queryKeys.institutionScope, 'consents', 'pending'], queryFn: () => apiClient.students.pendingConsents({}) }, queryClient)
    const state = query.isPending ? { status: 'loading' as const } : query.isError ? { status: 'error' as const } : { status: 'ready' as const, items: query.data }
    return { state, confirm: (studentId: StudentId) => apiClient.students.confirmConsent({ studentId }).then(async result => { await queryClient.invalidateQueries({ queryKey: [...queryKeys.institutionScope, 'consents', 'pending'] }); return result }), async refresh() { await query.refetch() } }
  }

  function useStudentPicker(institutionId: InstitutionId) {
    const [selectedStudentId, setSelectedStudentId] = useState<StudentId | undefined>()
    const query = useQuery({ queryKey: [...queryKeys.institutionStudents(institutionId), 'picker'], queryFn: async () => {
      const first = await apiClient.students.list({ institutionId, page: 1, pageSize: 50 })
      const items = [...first.items]
      for (let page = 2; items.length < first.total; page++) {
        const next = await apiClient.students.list({ institutionId, page, pageSize: 50 })
        items.push(...next.items)
        if (next.items.length === 0) break
      }
      return { items, total: items.length, page: 1, pageSize: items.length }
    } }, queryClient)
    const preference = useQuery({ queryKey: [...queryKeys.institutionStudents(institutionId), 'picker-preference'], queryFn: () => preferenceStorage.read() }, queryClient)
    const state: StudentListState = query.isPending ? { status: 'loading' } : query.isError ? { status: 'error' } : { status: 'ready', ...query.data }
    const remembered = preference.data === undefined ? undefined : query.data?.items.find(item => `${institutionId}:${item.id}` === preference.data)?.id
    const selected = selectedStudentId !== undefined && query.data?.items.some(item => item.id === selectedStudentId) ? selectedStudentId : remembered ?? query.data?.items[0]?.id
    return { state, selectedStudentId: selected, async selectStudent(studentId: StudentId) { if (!query.data?.items.some(item => item.id === studentId)) return; setSelectedStudentId(studentId); await preferenceStorage.write(`${institutionId}:${studentId}`) } }
  }

  return { useStudentList, useStudentDetail, useStudentForm, useStudentActions, usePendingConsents, useStudentPicker }
}
