import type { LocalDate } from '@habituar/core/calendar'
import type { InstitutionId, RoutineEntryPhotoId, StudentId } from '@habituar/core/identity/ids'

/**
 * Única fonte das chaves de query do cliente. Todo dado de tenant mora sob
 * `INSTITUTION_SCOPE`, porque é esse prefixo que a troca de instituição apaga: chave de
 * tenant fora dele sobreviveria à troca e mostraria dado da instituição anterior. A
 * plataforma tem namespace próprio, sempre com a instituição explícita na chave.
 */
export const queryKeys = {
  institutionScope: ['institution'],
  institutionStaff: (institutionId: InstitutionId) => ['institution', institutionId, 'staff'],
  students: (institutionId: InstitutionId) => ['institution', institutionId, 'students'],
  studentDetail: (institutionId: InstitutionId, studentId: StudentId) => ['institution', institutionId, 'students', studentId, 'detail'],
  studentRecord: (institutionId: InstitutionId, studentId: StudentId) => ['institution', institutionId, 'students', studentId, 'record'],
  studentHistory: (institutionId: InstitutionId, studentId: StudentId) => ['institution', institutionId, 'students', studentId, 'history'],
  studentConsultations: (institutionId: InstitutionId, studentId: StudentId) => ['institution', institutionId, 'students', studentId, 'consultations'],
  studentRoutine: (institutionId: InstitutionId, studentId: StudentId) => ['institution', institutionId, 'students', studentId, 'routine'],
  // Intervalo na ponta da chave: o escopo sem ele invalida todas as janelas já vistas.
  studentRoutineEntriesScope: (institutionId: InstitutionId, studentId: StudentId) => ['institution', institutionId, 'students', studentId, 'routine-entries'],
  studentRoutineEntries: (institutionId: InstitutionId, studentId: StudentId, from: LocalDate, to: LocalDate) => ['institution', institutionId, 'students', studentId, 'routine-entries', from, to],
  routineEntryPhoto: (institutionId: InstitutionId, studentId: StudentId, photoId: RoutineEntryPhotoId) => ['institution', institutionId, 'students', studentId, 'routine-entry-photos', photoId],
  studentAppointmentsScope: (institutionId: InstitutionId, studentId: StudentId) => ['institution', institutionId, 'students', studentId, 'appointments'],
  studentAppointments: (institutionId: InstitutionId, studentId: StudentId, from: LocalDate, to: LocalDate) => ['institution', institutionId, 'students', studentId, 'appointments', from, to],
  institutionAgendaScope: (institutionId: InstitutionId) => ['institution', institutionId, 'appointments'],
  institutionAgenda: (institutionId: InstitutionId, from: LocalDate, to: LocalDate) => ['institution', institutionId, 'appointments', from, to],
  institutionStudents: (institutionId: InstitutionId) => ['institution', institutionId, 'students'],
  platformInstitutions: ['platform', 'institutions'],
  platformInstitution: (institutionId: InstitutionId) => ['platform', 'institution', institutionId],
  platformInstitutionStaff: (institutionId: InstitutionId) => ['platform', 'institution', institutionId, 'staff'],
  invitationScope: ['invitation'],
  // Dados da própria pessoa, fora de qualquer instituição: saem junto com a sessão, senão
  // quem entrar depois no mesmo aparelho veria os consentimentos de quem saiu.
  personalScope: ['me'],
  ownConsents: ['me', 'consents'],
  pendingConsents: ['me', 'consents', 'pending'],
  invitation: (token: string) => ['invitation', token],
} as const
