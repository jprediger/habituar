import type { LocalDate } from '@habituar/core/calendar'
import type { InstitutionId, StudentId, TaskPhotoId } from '@habituar/core/identity/ids'

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
  // Intervalo na ponta da chave: o escopo sem ele invalida todas as janelas já vistas.
  studentTasksScope: (institutionId: InstitutionId, studentId: StudentId) => ['institution', institutionId, 'students', studentId, 'tasks'],
  studentTasks: (institutionId: InstitutionId, studentId: StudentId, from: LocalDate, to: LocalDate) => ['institution', institutionId, 'students', studentId, 'tasks', from, to],
  taskPhoto: (institutionId: InstitutionId, studentId: StudentId, photoId: TaskPhotoId) => ['institution', institutionId, 'students', studentId, 'task-photos', photoId],
  studentAppointmentsScope: (institutionId: InstitutionId, studentId: StudentId) => ['institution', institutionId, 'students', studentId, 'appointments'],
  studentAppointments: (institutionId: InstitutionId, studentId: StudentId, from: LocalDate, to: LocalDate) => ['institution', institutionId, 'students', studentId, 'appointments', from, to],
  institutionAgendaScope: (institutionId: InstitutionId) => ['institution', institutionId, 'appointments'],
  report: (institutionId: InstitutionId, from: LocalDate, to: LocalDate, studentId?: StudentId) => ['institution', institutionId, 'reports', from, to, studentId ?? 'all'],
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
  // Preferência do aparelho, não da pessoa nem da instituição: sobrevive à troca de
  // instituição e à saída, como o próprio armazenamento local de onde vem.
  calendarFilter: ['device', 'calendar-filter'],
} as const
