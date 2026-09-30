import type { MembershipContext } from '@habituar/core/auth/context'
import type { StudentId } from '@habituar/core/identity/ids'
import type {
  ConsultationInput,
  ObservationInput,
  StudentConsultation,
  StudentHistoryEntry,
  StudentProfileInput,
  StudentRecord,
} from '@habituar/core/student-records'
import type { StudentDetail, StudentSummary } from '@habituar/core/students'
import type { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { ApiClient } from './api-client.js'
import { queryKeys } from './query-keys.js'
import type { Pagination } from './staff-management.js'
import { hasServerResponse, readFailureCode } from './request-failure.js'

const STUDENT_PAGE_SIZE = 20

/** Por que a ficha ou a lista não abriu; `forbidden` e `not-found` pedem textos diferentes. */
export type StudentLoadFailure = 'forbidden' | 'not-found' | 'failed'

export type StudentListState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: StudentLoadFailure }>
  | Readonly<{ status: 'ready'; students: readonly StudentSummary[]; total: number; page: number; pageCount: number }>

/**
 * Alunos que o alcance de `student.read` cobre. Abrir a ficha é outra permissão: quem
 * acompanha sem ler dado sensível (monitoria) vê o aluno e não recebe o link.
 */
export type AccessibleStudents = Readonly<{
  state: StudentListState
  searchDraft: string
  setSearchDraft: (value: string) => void
  /** Busca só no envio: consultar a cada tecla anunciaria resultados parciais ao leitor de tela. */
  applySearch: () => void
  clearSearch: () => void
  activeSearch: string
  pagination: Pagination
  canOpenRecord: boolean
}>

export type StudentRecordState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: StudentLoadFailure }>
  | Readonly<{ status: 'ready'; student: StudentDetail; record: StudentRecord }>

export type StudentHistoryState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'ready'; entries: readonly StudentHistoryEntry[] }>

export type StudentConsultationsState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'ready'; consultations: readonly StudentConsultation[] }>

export type StudentRecordAccess = Readonly<{
  record: StudentRecordState
  history: StudentHistoryState
  consultations: StudentConsultationsState
  /**
   * Dica de interface, não autorização: a API confere `record.write` de novo em cada envio.
   * Aluno arquivado fica só para leitura, como a API exige.
   */
  canWrite: boolean
  recordProfile: (input: StudentProfileInput) => Promise<void>
  addObservation: (input: ObservationInput) => Promise<void>
  recordConsultation: (input: ConsultationInput) => Promise<void>
}>

export type StudentRecordHooks = Readonly<{
  useAccessibleStudents: (membership: MembershipContext) => AccessibleStudents
  useStudentRecord: (membership: MembershipContext, studentId: StudentId) => StudentRecordAccess
}>

type StudentRecordHookDependencies = Readonly<{ apiClient: ApiClient; queryClient: QueryClient }>

function toStudentLoadFailure(error: unknown): StudentLoadFailure {
  const code = readFailureCode(error)
  if (code === 'forbidden') return 'forbidden'
  if (code === 'not_found' || code === 'student-not-found') return 'not-found'
  return 'failed'
}

// Resposta do servidor (403, 404) não muda com repetição; só falha de rede merece nova tentativa.
function retryOnlyWithoutServerResponse(failureCount: number, error: unknown): boolean {
  return !hasServerResponse(error) && failureCount < 3
}

function holds(membership: MembershipContext, permission: 'record.read' | 'record.write'): boolean {
  return membership.permissions.some((grant) => grant.key === permission)
}

/**
 * Dono do estado de servidor da lista de alunos e da ficha. O cadastro (nome, nascimento,
 * responsáveis) vem da fatia de alunos; os dados de apoio, observações e consultas, da
 * ficha — a tela recebe os dois juntos e não precisa saber de onde cada um veio.
 */
export function createStudentRecordHooks(dependencies: StudentRecordHookDependencies): StudentRecordHooks {
  const { apiClient, queryClient } = dependencies

  function useAccessibleStudents(membership: MembershipContext): AccessibleStudents {
    const institutionId = membership.institution.id
    const [searchDraft, setSearchDraft] = useState('')
    const [activeSearch, setActiveSearch] = useState('')
    const [page, setPage] = useState(1)
    const query = useQuery({
      queryKey: [...queryKeys.students(institutionId), { search: activeSearch, page }],
      queryFn: () => apiClient.students.list({ institutionId, archived: false, page, pageSize: STUDENT_PAGE_SIZE, ...(activeSearch === '' ? {} : { search: activeSearch }) }),
      retry: retryOnlyWithoutServerResponse,
    }, queryClient)

    const pageCount = query.data === undefined ? 1 : Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    const state: StudentListState = query.isPending
      ? { status: 'loading' }
      : query.isError
        ? { status: 'failed', failure: toStudentLoadFailure(query.error) }
        : { status: 'ready', students: query.data.items, total: query.data.total, page: query.data.page, pageCount }

    // Busca nova volta à primeira página: continuar na página 3 de outro filtro mostraria vazio.
    function search(value: string): void {
      setActiveSearch(value)
      setPage(1)
    }

    return {
      state,
      searchDraft,
      setSearchDraft,
      applySearch: () => { search(searchDraft.trim()) },
      clearSearch: () => { setSearchDraft(''); search('') },
      activeSearch,
      pagination: {
        hasPreviousPage: page > 1,
        hasNextPage: page < pageCount,
        goToPreviousPage: () => { setPage(Math.max(1, page - 1)) },
        goToNextPage: () => { setPage(Math.min(pageCount, page + 1)) },
      },
      canOpenRecord: holds(membership, 'record.read'),
    }
  }

  function useStudentRecord(membership: MembershipContext, studentId: StudentId): StudentRecordAccess {
    const institutionId = membership.institution.id
    const detailKey = queryKeys.studentDetail(institutionId, studentId)
    const recordKey = queryKeys.studentRecord(institutionId, studentId)
    const historyKey = queryKeys.studentHistory(institutionId, studentId)
    const consultationsKey = queryKeys.studentConsultations(institutionId, studentId)
    const detail = useQuery({ queryKey: detailKey, queryFn: () => apiClient.students.get({ institutionId, studentId }), retry: retryOnlyWithoutServerResponse }, queryClient)
    const record = useQuery({ queryKey: recordKey, queryFn: () => apiClient.studentRecords.get({ institutionId, studentId }), retry: retryOnlyWithoutServerResponse }, queryClient)
    const history = useQuery({ queryKey: historyKey, queryFn: () => apiClient.studentRecords.listHistory({ institutionId, studentId }), retry: retryOnlyWithoutServerResponse }, queryClient)
    const consultations = useQuery({ queryKey: consultationsKey, queryFn: () => apiClient.studentRecords.listConsultations({ institutionId, studentId }), retry: retryOnlyWithoutServerResponse }, queryClient)

    const recordState: StudentRecordState = detail.isError
      ? { status: 'failed', failure: toStudentLoadFailure(detail.error) }
      : record.isError
        ? { status: 'failed', failure: toStudentLoadFailure(record.error) }
        : detail.isPending || record.isPending
          ? { status: 'loading' }
          : { status: 'ready', student: detail.data, record: record.data }

    async function recordProfile(input: StudentProfileInput): Promise<void> {
      try {
        queryClient.setQueryData(recordKey, await apiClient.studentRecords.recordProfile({ ...input, institutionId, studentId }))
      } catch (error) {
        // Conflito significa que a versão em tela está velha: buscar a atual antes de relançar
        // deixa o formulário comparar com ela e a tela mostrar quem gravou por último.
        if (readFailureCode(error) === 'conflict') await queryClient.invalidateQueries({ queryKey: recordKey })
        throw error
      }
      await queryClient.invalidateQueries({ queryKey: historyKey })
    }

    return {
      record: recordState,
      history: history.isPending ? { status: 'loading' } : history.isError ? { status: 'failed' } : { status: 'ready', entries: history.data },
      consultations: consultations.isPending
        ? { status: 'loading' }
        : consultations.isError ? { status: 'failed' } : { status: 'ready', consultations: consultations.data },
      canWrite: holds(membership, 'record.write') && detail.data?.archivedAt === null,
      recordProfile,
      addObservation: async (input) => {
        await apiClient.studentRecords.addObservation({ ...input, institutionId, studentId })
        await queryClient.invalidateQueries({ queryKey: historyKey })
      },
      recordConsultation: async (input) => {
        await apiClient.studentRecords.recordConsultation({ ...input, institutionId, studentId })
        await queryClient.invalidateQueries({ queryKey: consultationsKey })
      },
    }
  }

  return { useAccessibleStudents, useStudentRecord }
}
