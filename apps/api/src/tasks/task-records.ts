import { assertNever } from '@habituar/core/assert-never'
import { type OccurrenceException, type Schedule, type ScheduleTime, occurrenceExceptionSchema, scheduleSchema } from '@habituar/core/schedule'
import { type Task, type TaskOccurrence, taskOccurrenceSchema, taskSchema } from '@habituar/core/tasks'
import type { TaskOccurrenceEvaluationRow, TaskOccurrencePhotoRow, TaskOccurrenceRow } from './task-occurrences.repository.js'
import type { TaskRow, TaskScheduleValues } from './tasks.repository.js'

// O Postgres devolve `time` como HH:MM:SS; o contrato trabalha em HH:MM.
// Coluna fora do esperado chega ao schema como está e falha no parse: dado corrompido é bug.
function readTime(kind: string | null, startsAt: string | null, endsAt: string | null): unknown {
  return kind === 'timed' ? { kind, startsAt: startsAt?.slice(0, 5), endsAt: endsAt?.slice(0, 5) } : { kind }
}

function timeColumns(time: ScheduleTime): Readonly<{ kind: ScheduleTime['kind']; startsAt: string | null; endsAt: string | null }> {
  switch (time.kind) {
    case 'all-day': return { kind: time.kind, startsAt: null, endsAt: null }
    case 'timed': return { kind: time.kind, startsAt: time.startsAt, endsAt: time.endsAt }
    default: return assertNever(time)
  }
}

/** Agenda da série a partir das colunas, conferida pelo mesmo schema da borda. */
export function readSchedule(row: TaskRow): Schedule {
  return scheduleSchema.parse({
    startsOn: row.startsOn,
    time: readTime(row.timeKind, row.startsAt, row.endsAt),
    recurrence: row.recurrenceKind === 'weekly'
      ? { kind: row.recurrenceKind, weekdays: row.recurrenceWeekdays, until: row.recurrenceUntil }
      : row.recurrenceKind === 'daily' ? { kind: row.recurrenceKind, until: row.recurrenceUntil } : { kind: row.recurrenceKind },
  })
}

/** Colunas que guardam uma agenda; o inverso exato de `readSchedule`. */
export function scheduleColumns(schedule: Schedule): TaskScheduleValues {
  const time = timeColumns(schedule.time)
  const base = { startsOn: schedule.startsOn, timeKind: time.kind, startsAt: time.startsAt, endsAt: time.endsAt }
  switch (schedule.recurrence.kind) {
    case 'none': return { ...base, recurrenceKind: 'none', recurrenceWeekdays: null, recurrenceUntil: null }
    case 'daily': return { ...base, recurrenceKind: 'daily', recurrenceWeekdays: null, recurrenceUntil: schedule.recurrence.until }
    case 'weekly': return { ...base, recurrenceKind: 'weekly', recurrenceWeekdays: [...schedule.recurrence.weekdays].sort((first, second) => first - second), recurrenceUntil: schedule.recurrence.until }
    default: return assertNever(schedule.recurrence)
  }
}

/** Série no formato do contrato. */
export function toTask(row: TaskRow): Task {
  return taskSchema.parse({
    id: row.id,
    studentId: row.studentId,
    origin: row.origin,
    title: row.title,
    kind: row.kind,
    notes: row.notes,
    schedule: readSchedule(row),
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  })
}

/** Ajuste guardado na linha da ocorrência. */
export function readException(row: TaskOccurrenceRow): OccurrenceException {
  if (row.exceptionKind !== 'moved') return occurrenceExceptionSchema.parse({ kind: row.exceptionKind })
  return occurrenceExceptionSchema.parse({ kind: 'moved', date: row.movedDate, time: readTime(row.movedTimeKind, row.movedStartsAt, row.movedEndsAt) })
}

/** Colunas de ajuste de uma ocorrência; o inverso de `readException`. */
export function exceptionColumns(exception: OccurrenceException) {
  switch (exception.kind) {
    case 'none':
    case 'cancelled':
      return { exceptionKind: exception.kind, movedDate: null, movedTimeKind: null, movedStartsAt: null, movedEndsAt: null }
    case 'moved': {
      const time = timeColumns(exception.time)
      return { exceptionKind: exception.kind, movedDate: exception.date, movedTimeKind: time.kind, movedStartsAt: time.startsAt, movedEndsAt: time.endsAt }
    }
    default: return assertNever(exception)
  }
}

/** Ocorrências no formato do contrato, cada uma com as próprias fotos e avaliação. */
export function toOccurrences(rows: readonly TaskOccurrenceRow[], photos: readonly TaskOccurrencePhotoRow[], evaluations: readonly TaskOccurrenceEvaluationRow[]): TaskOccurrence[] {
  return rows.map(row => {
    const evaluation = evaluations.find(candidate => candidate.occurrenceId === row.id)
    return taskOccurrenceSchema.parse({
      taskId: row.taskId,
      originalDate: row.originalDate,
      exception: readException(row),
      notes: row.notes,
      photos: photos.filter(photo => photo.occurrenceId === row.id).map(photo => ({ id: photo.id, mediaType: photo.mediaType, byteSize: photo.byteSize, createdAt: photo.createdAt.toISOString() })),
      completedAt: row.completedAt?.toISOString() ?? null,
      evaluation: evaluation === undefined ? null : { outcome: evaluation.outcome, comment: evaluation.comment, evaluatorName: evaluation.evaluatorName, version: evaluation.version, updatedAt: evaluation.updatedAt.toISOString() },
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    })
  })
}
