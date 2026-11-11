import { studentIdSchema } from '@habituar/core/identity/ids'
import { studentConsultationSchema, studentHistoryEntrySchema, studentRecordSchema } from '@habituar/core/student-records'
import { studentDetailSchema } from '@habituar/core/students'
import type { StudentConsultationsAccess, StudentHistoryAccess, StudentRecordOverview } from '@habituar/react-client/react-client'

// Dados comuns aos testes das telas da ficha: um estudante com ficha preenchida, consulta e
// histórico. Tudo passa pelo schema do contrato, para o fixture não aceitar o que a API recusaria.
export const RECORD_STUDENT_ID = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')

const author = { id: '20000000-0000-4000-8000-000000000002', name: 'Ana Souza' }

export const RECORD_STUDENT = studentDetailSchema.parse({
  id: RECORD_STUDENT_ID,
  fullName: 'Bruno Lima',
  socialName: null,
  birthDate: '2014-03-09',
  ageRange: '11-14',
  archivedAt: null,
  version: 1,
  guardians: [{ id: '70000000-0000-4000-8000-000000000001', fullName: 'Marta Lima', email: null, phone: '+55 51 99999-0000', relationship: 'mother' }],
  assignments: [],
  consentStatus: 'institution-recorded',
  accountStatus: 'none',
  institutionalDocumentName: null,
  institutionalDocumentId: null,
})

export const ARCHIVED_RECORD_STUDENT = studentDetailSchema.parse({ ...RECORD_STUDENT, archivedAt: '2026-09-20T12:00:00.000Z' })

export const FILLED_RECORD = studentRecordSchema.parse({
  studentId: RECORD_STUDENT_ID,
  profile: {
    status: 'filled',
    revision: {
      id: '40000000-0000-4000-8000-000000000001',
      schoolGrade: '5º ano B',
      conditions: ['adhd'],
      supportNeeds: null,
      recordedAt: '2026-09-01T12:00:00.000Z',
      recordedBy: author,
    },
  },
})

export const EMPTY_RECORD = studentRecordSchema.parse({ studentId: RECORD_STUDENT_ID, profile: { status: 'empty' } })

export const RECORD_HISTORY = [
  studentHistoryEntrySchema.parse({ kind: 'observation', id: '50000000-0000-4000-8000-000000000001', body: 'Concentrou-se melhor com pausas curtas.', recordedAt: '2026-09-02T12:00:00.000Z', recordedBy: author }),
  studentHistoryEntrySchema.parse({ kind: 'profile-revision', id: '40000000-0000-4000-8000-000000000001', changedFields: ['schoolGrade', 'conditions'], recordedAt: '2026-09-01T12:00:00.000Z', recordedBy: author }),
]

export const RECORD_CONSULTATION = studentConsultationSchema.parse({
  id: '60000000-0000-4000-8000-000000000001',
  occurredAt: '2026-09-03T17:00:00.000Z',
  durationMinutes: 50,
  notes: 'Montamos juntos a agenda de estudos da semana.',
  recordedAt: '2026-09-03T18:00:00.000Z',
  recordedBy: author,
})

/** Entrada da ficha pronta; o teste sobrescreve só o que o caso exige. */
export function createRecordOverview(overrides: Partial<StudentRecordOverview> = {}): StudentRecordOverview {
  return {
    record: { status: 'ready', student: RECORD_STUDENT, record: FILLED_RECORD },
    canWrite: true,
    recordProfile: jest.fn(() => Promise.resolve()),
    ...overrides,
  }
}

/** Seção de consultas pronta, com uma consulta; o teste sobrescreve só o que o caso exige. */
export function createConsultationsAccess(overrides: Partial<StudentConsultationsAccess> = {}): StudentConsultationsAccess {
  return {
    consultations: { status: 'ready', consultations: [RECORD_CONSULTATION] },
    canWrite: true,
    recordConsultation: jest.fn(() => Promise.resolve()),
    ...overrides,
  }
}

/** Histórico pronto, com uma observação e uma atualização; o teste sobrescreve só o que o caso exige. */
export function createHistoryAccess(overrides: Partial<StudentHistoryAccess> = {}): StudentHistoryAccess {
  return {
    history: { status: 'ready', entries: RECORD_HISTORY },
    canWrite: true,
    addObservation: jest.fn(() => Promise.resolve()),
    ...overrides,
  }
}
