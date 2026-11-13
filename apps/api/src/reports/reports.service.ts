import { type LocalDate, localDateInTimeZone, localDateSchema } from '@habituar/core/calendar'
import { type Outcome } from '@habituar/core/failure'
import { type Report, type ReportFilter, type ReportPdf, type ReportStatus } from '@habituar/core/reports'
import { studentIdSchema, taskIdSchema } from '@habituar/core/identity/ids'
import { expandOccurrences } from '@habituar/core/schedule'
import { Injectable } from '@nestjs/common'
import type { Actor } from '../authorization/authentication.guard.js'
import { Database } from '../database/database.js'
import { Clock } from '../platform/clock.js'
import { RbacService } from '../rbac/rbac.service.js'
import { readException, readSchedule } from '../tasks/task-records.js'
import { type ReportOccurrenceRow, type ReportTaskRow, ReportsRepository } from './reports.repository.js'
import { composeReport } from './reports-metrics.js'
import { ReportsPdfService } from './reports-pdf.service.js'

type Denial = 'forbidden' | 'student-not-found'
function fail<T>(code: Denial, message: string): Outcome<T> {
  return { status: 'failure', failure: { code, message } }
}

const STUDENT_BATCH_SIZE = 200

/** Consolida tarefas dentro do tenant e aplica a interseção dos escopos antes de qualquer leitura. */
@Injectable()
export class ReportsService {
  constructor(
    private readonly database: Database,
    private readonly repository: ReportsRepository,
    private readonly rbac: RbacService,
    private readonly clock: Clock,
    private readonly pdf: ReportsPdfService,
  ) {}

  async get(actor: Actor, filter: ReportFilter): Promise<Outcome<Report>> {
    return this.makeReport(actor, filter, false)
  }

  async exportPdf(actor: Actor, filter: ReportFilter): Promise<Outcome<ReportPdf>> {
    const report = await this.makeReport(actor, filter, true)
    if (report.status === 'failure') return report
    return { status: 'success', value: this.pdf.render(report.value) }
  }

  private async makeReport(actor: Actor, filter: ReportFilter, exporting: boolean): Promise<Outcome<Report>> {
    return this.database.withTenant(async transaction => {
      const readScopes = await this.rbac.listPermissionScopesInTransaction(transaction, actor, filter.institutionId, 'report.read')
      const exportScopes = exporting ? await this.rbac.listPermissionScopesInTransaction(transaction, actor, filter.institutionId, 'report.export') : readScopes
      const readAny = readScopes.includes('institution') || readScopes.includes('assigned')
      const exportAny = exportScopes.includes('institution') || exportScopes.includes('assigned')
      const scope = readScopes.includes('institution') && exportScopes.includes('institution')
        ? 'institution' : readAny && exportAny ? 'assigned' : undefined
      if (scope === undefined) return fail<Report>('forbidden', 'Report access requires a valid team scope.')

      const institution = await this.repository.institution(transaction, filter.institutionId)
      if (institution === undefined) return fail<Report>('forbidden', 'Institution is inaccessible.')
      const students = await this.repository.listEligibleStudents(transaction, actor.userId, scope, filter.studentId)
      if (filter.studentId !== undefined && students.length === 0) return fail<Report>('student-not-found', 'Student not found.')
      const range = { from: filter.from, to: filter.to }
      const rows: ReportTaskRow[] = []
      const occurrenceRows: ReportOccurrenceRow[] = []
      // Lotes evitam milhares de parâmetros SQL, sem limitar a visão institucional.
      for (let index = 0; index < students.length; index += STUDENT_BATCH_SIZE) {
        const studentIds = students.slice(index, index + STUDENT_BATCH_SIZE).map(student => student.id)
        rows.push(...await this.repository.listTasks(transaction, studentIds, range))
        occurrenceRows.push(...await this.repository.listOccurrences(transaction, studentIds, range))
      }
      const occurrenceByTask = new Map<string, ReportOccurrenceRow[]>()
      for (const row of occurrenceRows) {
        const existing = occurrenceByTask.get(row.occurrence.taskId) ?? []
        existing.push(row)
        occurrenceByTask.set(row.occurrence.taskId, existing)
      }
      const today: LocalDate = localDateInTimeZone(this.clock.now(), institution.timeZone)
      const activities = rows.flatMap(task => {
        const recorded = occurrenceByTask.get(task.id) ?? []
        const byOriginalDate = new Map(recorded.map(row => [row.occurrence.originalDate, row]))
        const adjustments = recorded.map(row => ({ originalDate: localDateSchema.parse(row.occurrence.originalDate), exception: readException(row.occurrence) }))
        return expandOccurrences(readSchedule(task), adjustments, range).map(occurrence => {
          const persisted = byOriginalDate.get(occurrence.originalDate)
          const status: ReportStatus = persisted?.occurrence.completedAt !== null && persisted?.occurrence.completedAt !== undefined
            ? 'completed' : occurrence.date < today ? 'missed' : 'upcoming'
          return {
            studentId: studentIdSchema.parse(task.studentId),
            taskId: taskIdSchema.parse(task.id),
            title: task.title,
            kind: task.kind,
            origin: task.origin,
            originalDate: occurrence.originalDate,
            date: occurrence.date,
            status,
            evaluation: persisted?.evaluation ?? null,
          }
        })
      })
      return { status: 'success', value: composeReport({
        institution: { id: filter.institutionId, name: institution.name }, range,
        generatedAt: this.clock.now().toISOString(), timeZone: institution.timeZone, today,
        students: students.map(student => ({ id: studentIdSchema.parse(student.id), name: student.name })), activities,
      }) }
    })
  }
}
