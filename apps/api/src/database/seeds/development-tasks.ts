import { assertNever } from '@habituar/core/assert-never'
import { addDays, type LocalDate, localDateInTimeZone, type Weekday, weekdayOfLocalDate } from '@habituar/core/calendar'
import { type Schedule, expandOccurrences, scheduleSchema } from '@habituar/core/schedule'
import type { TaskEvaluationOutcome, TaskKind, TaskOrigin } from '@habituar/core/tasks'
import { eq } from 'drizzle-orm'
import { scheduleColumns } from '../../tasks/task-records.js'
import { DatabaseTransaction } from '../database.js'
import { institutions, taskOccurrenceEvaluations, taskOccurrences, tasks } from '../schema.js'

// Quando, relativo ao dia em que o seed roda: com data fixa, a agenda abriria vazia uma
// semana depois. Toda conta é em dias no calendário da instituição.
type SeededStart = Readonly<{ daysFromToday: number }>
type SeededRecurrence =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'daily'; lastDayFromToday: number | null }>
  | Readonly<{ kind: 'weekly'; weekdays: readonly Weekday[] }>

// Registro das ocorrências passadas mais recentes da série: as `count` últimas até ontem.
type SeededRecords = Readonly<{ count: number; notes: string | null; evaluation: Readonly<{ outcome: TaskEvaluationOutcome; comment: string | null }> | null }>

type SeededTask = Readonly<{
  origin: TaskOrigin
  title: string
  kind: TaskKind | null
  notes: string | null
  start: SeededStart
  time: Readonly<{ startsAt: string; endsAt: string }> | null
  recurrence: SeededRecurrence
  records: SeededRecords | null
}>

// Cobre o que a agenda distingue: as duas origens, série semanal em vários dias, diária com
// e sem término, avulsa passada e futura, com e sem horário, concluída, com observação e
// avaliada. A rotina semanal de antes virou as séries semanais da equipe.
const SEEDED_TASKS: readonly SeededTask[] = [
  { origin: 'staff', title: 'Aulas', kind: 'class', notes: null, start: { daysFromToday: -28 }, time: { startsAt: '07:30', endsAt: '12:00' }, recurrence: { kind: 'weekly', weekdays: [1, 2, 3, 4, 5] }, records: null },
  { origin: 'staff', title: 'Tarefa de casa', kind: 'study', notes: 'Exercícios do caderno de matemática.', start: { daysFromToday: -28 }, time: { startsAt: '14:00', endsAt: '15:00' }, recurrence: { kind: 'weekly', weekdays: [1, 3] }, records: { count: 3, notes: 'Fiz todos os exercícios da página.', evaluation: { outcome: 'achieved', comment: 'Muito bem, capricho na letra.' } } },
  { origin: 'staff', title: 'Atendimento de apoio', kind: 'therapy', notes: null, start: { daysFromToday: -28 }, time: { startsAt: '15:00', endsAt: '15:50' }, recurrence: { kind: 'weekly', weekdays: [3] }, records: null },
  { origin: 'staff', title: 'Natação', kind: 'activity', notes: 'Levar touca e toalha.', start: { daysFromToday: -28 }, time: { startsAt: '16:00', endsAt: '17:00' }, recurrence: { kind: 'weekly', weekdays: [5] }, records: { count: 2, notes: null, evaluation: null } },
  { origin: 'staff', title: 'Ler um capítulo do livro', kind: 'study', notes: null, start: { daysFromToday: -6 }, time: null, recurrence: { kind: 'daily', lastDayFromToday: 7 }, records: { count: 2, notes: 'Li o capítulo 3.', evaluation: { outcome: 'partial', comment: null } } },
  { origin: 'staff', title: 'Entregar trabalho de ciências', kind: 'study', notes: 'Cartaz sobre o ciclo da água.', start: { daysFromToday: 3 }, time: null, recurrence: { kind: 'none' }, records: null },
  { origin: 'student', title: 'Arrumar a mochila', kind: 'other', notes: null, start: { daysFromToday: -10 }, time: { startsAt: '20:00', endsAt: '20:15' }, recurrence: { kind: 'daily', lastDayFromToday: null }, records: { count: 4, notes: null, evaluation: null } },
  { origin: 'student', title: 'Treino de violão', kind: 'activity', notes: null, start: { daysFromToday: -21 }, time: { startsAt: '18:00', endsAt: '18:45' }, recurrence: { kind: 'weekly', weekdays: [2, 4] }, records: { count: 1, notes: 'Aprendi a música nova.', evaluation: null } },
  { origin: 'student', title: 'Revisar matemática', kind: 'study', notes: null, start: { daysFromToday: -2 }, time: { startsAt: '16:00', endsAt: '17:00' }, recurrence: { kind: 'none' }, records: { count: 1, notes: null, evaluation: null } },
  { origin: 'student', title: 'Levar autorização do passeio', kind: null, notes: null, start: { daysFromToday: 1 }, time: null, recurrence: { kind: 'none' }, records: null },
]

export type SeededTaskAuthors = Readonly<{ student: string; professional: string }>

/**
 * Tarefas de exemplo da agenda do estudante do seed, para a agenda do app não abrir vazia
 * no desenvolvimento local. Recusa aluno que já tem tarefa: repetir o seed duplicaria as
 * séries, e a pessoa pode ter editado as que existem.
 */
export async function seedDevelopmentTasks(
  transaction: DatabaseTransaction,
  institutionId: string,
  studentId: string,
  authors: SeededTaskAuthors,
  now: Date,
): Promise<void> {
  const [existing] = await transaction.select({ id: tasks.id }).from(tasks).where(eq(tasks.studentId, studentId)).limit(1)
  if (existing !== undefined) return
  const [institution] = await transaction.select({ timeZone: institutions.timeZone }).from(institutions).where(eq(institutions.id, institutionId))
  if (institution === undefined) throw new Error('Seed institution not found')
  const today = localDateInTimeZone(now, institution.timeZone)

  for (const seeded of SEEDED_TASKS) {
    const schedule = buildSchedule(seeded, today)
    const authorId = seeded.origin === 'staff' ? authors.professional : authors.student
    const [task] = await transaction.insert(tasks).values({
      institutionId,
      studentId,
      origin: seeded.origin,
      title: seeded.title,
      kind: seeded.kind,
      notes: seeded.notes,
      ...scheduleColumns(schedule),
      createdByUserId: authorId,
      updatedByUserId: authorId,
      createdAt: now,
      updatedAt: now,
    }).returning()
    if (task === undefined) throw new Error('Insert into tasks returned no row')
    if (seeded.records !== null) await seedRecords(transaction, { institutionId, studentId, taskId: task.id }, schedule, seeded.records, authors, today, now)
  }
}

function buildSchedule(seeded: SeededTask, today: LocalDate): Schedule {
  const time = seeded.time === null ? { kind: 'all-day' } : { kind: 'timed', ...seeded.time }
  const requestedStart = addDays(today, seeded.start.daysFromToday)
  switch (seeded.recurrence.kind) {
    case 'none':
      return scheduleSchema.parse({ startsOn: requestedStart, time, recurrence: { kind: 'none' } })
    case 'daily': {
      const lastDay = seeded.recurrence.lastDayFromToday
      return scheduleSchema.parse({ startsOn: requestedStart, time, recurrence: { kind: 'daily', until: lastDay === null ? null : addDays(today, lastDay) } })
    }
    case 'weekly': {
      // A série semanal começa num dos dias escolhidos: o primeiro deles a partir do dia pedido.
      const { weekdays } = seeded.recurrence
      const startsOn = [0, 1, 2, 3, 4, 5, 6].map(offset => addDays(requestedStart, offset)).find(date => weekdays.includes(weekdayOfLocalDate(date)))
      return scheduleSchema.parse({ startsOn, time, recurrence: { kind: 'weekly', weekdays, until: null } })
    }
    default:
      return assertNever(seeded.recurrence)
  }
}

async function seedRecords(
  transaction: DatabaseTransaction,
  key: Readonly<{ institutionId: string; studentId: string; taskId: string }>,
  schedule: Schedule,
  records: SeededRecords,
  authors: SeededTaskAuthors,
  today: LocalDate,
  now: Date,
): Promise<void> {
  // Só ocorrências que já passaram: conclusão adiantada é exatamente o que a API recusa.
  const recorded = expandOccurrences(schedule, [], { from: addDays(today, -27), to: addDays(today, -1) }).map(occurrence => occurrence.originalDate).slice(-records.count)
  for (const [index, originalDate] of recorded.entries()) {
    const isLatest = index === recorded.length - 1
    const [occurrence] = await transaction.insert(taskOccurrences).values({
      ...key,
      originalDate,
      notes: isLatest ? records.notes : null,
      completedAt: now,
      completedByUserId: authors.student,
      createdByUserId: authors.student,
      updatedByUserId: authors.student,
      createdAt: now,
      updatedAt: now,
    }).returning()
    if (occurrence === undefined) throw new Error('Insert into task_occurrences returned no row')
    if (records.evaluation !== null && !isLatest) {
      await transaction.insert(taskOccurrenceEvaluations).values({ institutionId: key.institutionId, occurrenceId: occurrence.id, outcome: records.evaluation.outcome, comment: records.evaluation.comment, evaluatedByUserId: authors.professional, createdAt: now, updatedAt: now })
    }
  }
}
