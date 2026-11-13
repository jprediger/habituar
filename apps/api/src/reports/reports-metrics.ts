import { type LocalDate, listRangeDays, weekdayOfLocalDate } from '@habituar/core/calendar'
import { type ReportActivity, type ReportCounters, type ReportStudent, type Report } from '@habituar/core/reports'
import { type TaskKind, TASK_KINDS } from '@habituar/core/tasks'
import { reportSchema } from '@habituar/core/reports'

function summarize(activities: readonly ReportActivity[]): ReportCounters {
  const completed = activities.filter(activity => activity.status === 'completed').length
  const missed = activities.filter(activity => activity.status === 'missed').length
  const upcoming = activities.length - completed - missed
  return {
    completed, missed, upcoming, total: activities.length,
    completionRate: completed + missed === 0 ? null : Math.round(completed * 10_000 / (completed + missed)) / 100,
  }
}

/** Monta indicadores objetivos sem classificar comportamento ou esforço pessoal. */
export function composeReport(input: Readonly<{
  institution: Report['institution']
  range: Report['range']
  generatedAt: string
  timeZone: string
  today: LocalDate
  students: readonly Readonly<{ id: ReportStudent['id']; name: string }>[]
  activities: readonly ReportActivity[]
}>): Report {
  const byWeekday = [1, 2, 3, 4, 5, 6, 7].map(weekday => ({ weekday, ...summarize(input.activities.filter(activity => weekdayOfLocalDate(activity.date) === weekday)) }))
  const byDay = listRangeDays(input.range).map(date => ({ date, ...summarize(input.activities.filter(activity => activity.date === date)) }))
  const byKind = ([...TASK_KINDS, null] satisfies (TaskKind | null)[]).map(kind => ({ kind, ...summarize(input.activities.filter(activity => activity.kind === kind)) }))
  const students = input.students.map(student => {
    const activities = input.activities.filter(activity => activity.studentId === student.id)
    return { ...student, ...summarize(activities), byWeekday: [1, 2, 3, 4, 5, 6, 7].map(weekday => ({ weekday, ...summarize(activities.filter(activity => weekdayOfLocalDate(activity.date) === weekday)) })) }
  }).sort((left, right) => (right.completionRate ?? -1) - (left.completionRate ?? -1) || right.completed - left.completed || left.name.localeCompare(right.name))
  return reportSchema.parse({
    institution: input.institution,
    range: input.range,
    generatedAt: input.generatedAt,
    timeZone: input.timeZone,
    today: input.today,
    summary: summarize(input.activities),
    byWeekday,
    byDay,
    byKind,
    students,
    activities: [...input.activities].sort((left, right) => right.date.localeCompare(left.date) || left.title.localeCompare(right.title)),
  })
}
