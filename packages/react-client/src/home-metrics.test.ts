import type { LocalDate } from '@habituar/core/calendar'
import { localDateSchema } from '@habituar/core/calendar'
import { describe, expect, it } from 'vitest'
import type { TrackedTaskStatus } from './agenda-hooks.js'
import { summarizeProfessionalHome, summarizeStudentHome } from './home-metrics.js'

const day = (value: string): LocalDate => localDateSchema.parse(value)
const TODAY = day('2026-11-11')

function taskDay(value: string, statuses: readonly TrackedTaskStatus[]) {
  return { date: day(value), tasks: statuses.map(status => ({ date: day(value), status })) }
}

function appointment(value: string, startsAt: string, endsAt: string, studentName: string) {
  return { kind: 'appointment' as const, date: day(value), startsAt, endsAt, occurrence: { appointment: { studentName } } }
}

describe('student home metrics', () => {
  it('counts what is already done today out of everything scheduled for today', () => {
    const metrics = summarizeStudentHome([taskDay('2026-11-11', ['completed', 'evaluated', 'missing'])], TODAY)
    expect(metrics.today).toEqual({ done: 2, total: 3 })
  })

  it('keeps the streak alive while today is still open and skips days without tasks', () => {
    const metrics = summarizeStudentHome([
      taskDay('2026-11-07', ['missing']),
      taskDay('2026-11-08', ['completed']),
      taskDay('2026-11-09', []),
      taskDay('2026-11-10', ['completed', 'evaluated']),
      taskDay('2026-11-11', ['missing']),
    ], TODAY)
    expect(metrics.streakDays).toBe(2)
  })

  it('adds today to the streak once every task of today is done', () => {
    const metrics = summarizeStudentHome([taskDay('2026-11-10', ['completed']), taskDay('2026-11-11', ['completed'])], TODAY)
    expect(metrics.streakDays).toBe(2)
  })

  it('rates the last seven days without punishing tasks still open today', () => {
    const metrics = summarizeStudentHome([
      taskDay('2026-11-01', ['missing']),
      taskDay('2026-11-09', ['completed', 'missing']),
      taskDay('2026-11-10', ['completed', 'completed']),
      taskDay('2026-11-11', ['missing']),
    ], TODAY)
    expect(metrics.weekRate).toBe(75)
    expect(metrics.weekMissing).toBe(1)
  })

  it('reports no rate when the week had nothing due', () => {
    expect(summarizeStudentHome([taskDay('2026-11-11', ['missing'])], TODAY).weekRate).toBeNull()
  })
})

describe('professional home metrics', () => {
  it('counts today and the week and points to the next appointment that has not ended', () => {
    const metrics = summarizeProfessionalHome([
      { items: [appointment('2026-11-11', '08:00', '09:00', 'Ana'), { kind: 'task' as const }, appointment('2026-11-11', '14:00', '15:00', 'Bia')] },
      { items: [appointment('2026-11-13', '10:00', '11:00', 'Caio')] },
    ], TODAY, '10:30')
    expect(metrics).toEqual({ todayAppointments: 2, weekAppointments: 3, next: { date: day('2026-11-11'), startsAt: '14:00', studentName: 'Bia' } })
  })

  it('has no next appointment when the week is empty', () => {
    expect(summarizeProfessionalHome([{ items: [] }], TODAY, '10:00').next).toBeUndefined()
  })
})
