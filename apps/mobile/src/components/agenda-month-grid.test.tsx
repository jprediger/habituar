import { localDateSchema, monthGridRange, listRangeDays } from '@habituar/core/calendar'
import { studentIdSchema } from '@habituar/core/identity/ids'
import { taskSchema } from '@habituar/core/tasks'
import type { CalendarEntry } from '@habituar/react-client/react-client'
import { fireEvent, render, screen } from '@testing-library/react-native'
import '../i18n/i18n'
import { AgendaMonthGrid } from './agenda-month-grid'

const TODAY = localDateSchema.parse('2026-11-11')
const MISSED = localDateSchema.parse('2026-11-10')
const TASK = taskSchema.parse({
  id: 'e1000000-0000-4000-8000-000000000001', studentId: studentIdSchema.parse('30000000-0000-4000-8000-000000000001'), origin: 'staff', title: 'Leitura', kind: null, notes: null,
  schedule: { startsOn: MISSED, time: { kind: 'timed', startsAt: '14:00', endsAt: '15:00' }, recurrence: { kind: 'none' } }, version: 1, updatedAt: '2026-11-01T12:00:00.000Z',
})

const MISSED_ENTRY: CalendarEntry = { kind: 'task', key: 'leitura', type: 'staff-task', task: TASK, occurrence: undefined, originalDate: MISSED, date: MISSED, time: TASK.schedule.time, status: 'missing' }

describe('agenda month grid', () => {
  const days = listRangeDays(monthGridRange(TODAY)).map(date => ({ date, entries: date === MISSED ? [MISSED_ENTRY] : [] }))

  it('reads each day with what is in it, including the missing mark, and opens it on tap', () => {
    const onOpenDay = jest.fn()
    render(<AgendaMonthGrid days={days} month={TODAY} today={TODAY} onOpenDay={onOpenDay} />)

    fireEvent.press(screen.getByRole('button', { name: /terça-feira, 10 de novembro de 2026, 1 itens: Leitura, Tarefa da equipe, .*14:00 às 15:00, Em falta/i }))

    expect(onOpenDay).toHaveBeenCalledWith(MISSED)
  })

  it('opens exactly the day of the pressed cell, not a neighbour or the first of the grid', () => {
    const onOpenDay = jest.fn()
    render(<AgendaMonthGrid days={days} month={TODAY} today={TODAY} onOpenDay={onOpenDay} />)

    fireEvent.press(screen.getByRole('button', { name: /quarta-feira, 11 de novembro de 2026/i }))

    expect(onOpenDay).toHaveBeenCalledTimes(1)
    expect(onOpenDay).toHaveBeenCalledWith(TODAY)
  })

  it('counts what does not fit in the cell instead of clipping it', () => {
    const busy = days.map(day => day.date === MISSED ? { ...day, entries: Array.from({ length: 5 }, (_, index) => ({ ...MISSED_ENTRY, key: `leitura-${String(index)}` })) } : day)
    render(<AgendaMonthGrid days={busy} month={TODAY} today={TODAY} onOpenDay={jest.fn()} />)

    expect(screen.getByText('+4')).toBeOnTheScreen()
  })
})
