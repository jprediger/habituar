import { localDateSchema } from '@habituar/core/calendar'
import { studentIdSchema } from '@habituar/core/identity/ids'
import { taskSchema } from '@habituar/core/tasks'
import type { CalendarEntry } from '@habituar/react-client/react-client'
import { MAX_PENDING_REMINDERS, planTaskReminders } from './task-reminders'

jest.mock('expo-notifications', () => ({}))

const STUDENT_ID = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const TODAY = localDateSchema.parse('2026-11-11')

function task(origin: 'student' | 'staff', time: { kind: 'all-day' } | { kind: 'timed'; startsAt: string; endsAt: string }) {
  return taskSchema.parse({
    id: origin === 'staff' ? 'e1000000-0000-4000-8000-000000000001' : 'e1000000-0000-4000-8000-000000000002', studentId: STUDENT_ID, origin, title: `Tarefa ${origin}`, kind: null, notes: null,
    schedule: { startsOn: '2026-11-01', time, recurrence: { kind: 'daily', until: null } }, version: 1, updatedAt: '2026-11-01T12:00:00.000Z',
  })
}

function entry(value: ReturnType<typeof task>, date: string, status: 'pending' | 'completed' = 'pending'): CalendarEntry {
  const day = localDateSchema.parse(date)
  return { kind: 'task', key: `${value.id}:${date}`, type: value.origin === 'staff' ? 'staff-task' : 'student-task', task: value, occurrence: undefined, originalDate: day, date: day, time: value.schedule.time, status }
}

describe('lembretes de tarefa', () => {
  const timed = task('staff', { kind: 'timed', startsAt: '00:10', endsAt: '01:00' })

  it('lembra no dia anterior quando a antecedência atravessa a meia-noite', () => {
    const plan = planTaskReminders(STUDENT_ID, [entry(timed, '2026-11-12')], [30], { date: TODAY, time: '08:00' })
    expect(plan.map(reminder => [reminder.date, reminder.time])).toEqual([['2026-11-11', '23:40']])
  })

  it('não lembra tarefa de dia inteiro, concluída ou cujo momento já passou', () => {
    const allDay = task('student', { kind: 'all-day' })
    const plan = planTaskReminders(STUDENT_ID, [entry(allDay, '2026-11-12'), entry(timed, '2026-11-12', 'completed'), entry(timed, '2026-11-11')], [30], { date: TODAY, time: '08:00' })
    expect(plan).toEqual([])
  })

  it('fica com os lembretes mais próximos até o limite do iOS', () => {
    const entries = Array.from({ length: 40 }, (_, index) => entry(timed, localDateSchema.parse(`2026-12-${String(index % 28 + 1).padStart(2, '0')}`)))
    const plan = planTaskReminders(STUDENT_ID, entries, [10, 60], { date: TODAY, time: '08:00' })
    expect(plan).toHaveLength(MAX_PENDING_REMINDERS)
    expect(plan[0]?.date).toBe('2026-11-30')
  })
})
