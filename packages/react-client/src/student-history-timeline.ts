import { assertNever } from '@habituar/core/assert-never'
import type { StudentHistoryEntry, StudentObservation } from '@habituar/core/student-records'

type ProfileRevisionEntry = Extract<StudentHistoryEntry, { kind: 'profile-revision' }>

/**
 * Período de um grupo da linha do tempo. Hoje e ontem têm nome próprio; o restante do mês
 * corrente vai por dia; o que é mais antigo vai por mês. `month` é de 1 a 12.
 */
export type StudentHistoryPeriod =
  | Readonly<{ kind: 'today' }>
  | Readonly<{ kind: 'yesterday' }>
  | Readonly<{ kind: 'day'; year: number; month: number; day: number }>
  | Readonly<{ kind: 'month'; year: number; month: number }>

/**
 * Um ponto da linha do tempo. Atualizações seguidas da mesma pessoa no mesmo dia viram um
 * ponto só: `latest` dá autor e hora, `changedFields` soma os campos sem repetir.
 */
export type StudentHistoryMoment =
  | Readonly<{ kind: 'observation'; observation: StudentObservation }>
  | Readonly<{ kind: 'profile-revisions'; latest: ProfileRevisionEntry; count: number; changedFields: ProfileRevisionEntry['changedFields'] }>

export type StudentHistoryPeriodGroup = Readonly<{ period: StudentHistoryPeriod; moments: readonly StudentHistoryMoment[] }>

type LocalDay = Readonly<{ year: number; month: number; day: number }>

/**
 * Dono do agrupamento do histórico da ficha em períodos e pontos, no fuso de quem lê.
 * Não reordena: a API já entrega do mais recente para o mais antigo, e é essa a ordem mostrada.
 */
export function groupStudentHistory(entries: readonly StudentHistoryEntry[], now: Date): readonly StudentHistoryPeriodGroup[] {
  const today = toLocalDay(now)
  const yesterday = toLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const groups: { period: StudentHistoryPeriod; moments: StudentHistoryMoment[]; lastEntry: StudentHistoryEntry }[] = []

  for (const entry of entries) {
    const period = periodOf(toLocalDay(new Date(entry.recordedAt)), today, yesterday)
    const current = groups.at(-1)

    if (current === undefined || !isSamePeriod(current.period, period)) {
      groups.push({ period, moments: [toMoment(entry)], lastEntry: entry })
      continue
    }

    const lastMoment = current.moments.at(-1)
    if (entry.kind === 'profile-revision' && lastMoment?.kind === 'profile-revisions' && continuesRevisions(current.lastEntry, entry)) {
      current.moments[current.moments.length - 1] = {
        ...lastMoment,
        count: lastMoment.count + 1,
        changedFields: [...new Set([...lastMoment.changedFields, ...entry.changedFields])],
      }
    } else {
      current.moments.push(toMoment(entry))
    }
    current.lastEntry = entry
  }

  return groups.map(({ period, moments }) => ({ period, moments }))
}

function toMoment(entry: StudentHistoryEntry): StudentHistoryMoment {
  return entry.kind === 'observation'
    ? { kind: 'observation', observation: entry }
    : { kind: 'profile-revisions', latest: entry, count: 1, changedFields: entry.changedFields }
}

function continuesRevisions(previous: StudentHistoryEntry, entry: ProfileRevisionEntry): boolean {
  return previous.kind === 'profile-revision'
    && previous.recordedBy.id === entry.recordedBy.id
    && isSameDay(toLocalDay(new Date(previous.recordedAt)), toLocalDay(new Date(entry.recordedAt)))
}

function periodOf(day: LocalDay, today: LocalDay, yesterday: LocalDay): StudentHistoryPeriod {
  if (isSameDay(day, today)) return { kind: 'today' }
  if (isSameDay(day, yesterday)) return { kind: 'yesterday' }
  if (day.year === today.year && day.month === today.month) return { kind: 'day', ...day }
  return { kind: 'month', year: day.year, month: day.month }
}

function isSamePeriod(a: StudentHistoryPeriod, b: StudentHistoryPeriod): boolean {
  switch (a.kind) {
    case 'today':
    case 'yesterday':
      return a.kind === b.kind
    case 'day':
      return b.kind === 'day' && isSameDay(a, b)
    case 'month':
      return b.kind === 'month' && a.year === b.year && a.month === b.month
    default:
      return assertNever(a)
  }
}

function isSameDay(a: LocalDay, b: LocalDay): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

function toLocalDay(instant: Date): LocalDay {
  return { year: instant.getFullYear(), month: instant.getMonth() + 1, day: instant.getDate() }
}
