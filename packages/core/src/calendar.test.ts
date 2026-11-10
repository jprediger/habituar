import { describe, expect, it } from 'vitest'
import { addDays, addMonths, buildMonthGrid, isAgendaRange, layoutDayEvents, listWeekDays, localDateSchema, monthGridRange, readLocalDateParts, startOfWeek, timeFromMinutes, weekdayOfLocalDate } from './calendar.js'

const day = (value: string) => localDateSchema.parse(value)

describe('calendário da agenda', () => {
  it('soma dias atravessando fim de mês e de ano', () => {
    expect(addDays(day('2026-12-30'), 3)).toBe('2027-01-02')
    expect(addDays(day('2026-03-01'), -1)).toBe('2026-02-28')
  })

  it('numera o dia da semana com segunda como 1 e domingo como 7', () => {
    expect(weekdayOfLocalDate(day('2026-11-09'))).toBe(1)
    expect(weekdayOfLocalDate(day('2026-11-15'))).toBe(7)
  })

  it('começa a semana na segunda, inclusive quando o dia é domingo', () => {
    expect(startOfWeek(day('2026-11-15'))).toBe('2026-11-09')
    expect(listWeekDays(day('2026-11-11'))).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
  })

  it('muda de mês sem estourar fevereiro', () => {
    expect(addMonths(day('2026-01-31'), 1)).toBe('2026-02-01')
    expect(addMonths(day('2026-01-15'), -1)).toBe('2025-12-01')
  })

  it('monta o mês em semanas completas de segunda a domingo', () => {
    const grid = buildMonthGrid(day('2026-11-20'))
    expect(grid[0]?.[0]).toBe('2026-10-26')
    expect(grid.at(-1)?.[6]).toBe('2026-12-06')
    expect(grid.every(week => week.length === 7)).toBe(true)
    expect(monthGridRange(day('2026-11-20'))).toEqual({ from: '2026-10-26', to: '2026-12-06' })
  })

  it('aceita intervalo que cabe numa grade de mês e recusa invertido ou longo demais', () => {
    expect(isAgendaRange({ from: '2026-10-26', to: '2026-12-06' })).toBe(true)
    expect(isAgendaRange({ from: '2026-11-10', to: '2026-11-09' })).toBe(false)
    expect(isAgendaRange({ from: '2026-01-01', to: '2026-12-31' })).toBe(false)
  })

  it('decompõe o dia em ano, mês, dia e dia da semana', () => {
    expect(readLocalDateParts(day('2026-11-15'))).toEqual({ year: 2026, month: 11, day: 15, weekday: 7 })
  })

  it('formata minutos como horário e não passa do fim do dia', () => {
    expect(timeFromMinutes(14 * 60 + 5)).toBe('14:05')
    expect(timeFromMinutes(24 * 60)).toBe('23:59')
  })
})

describe('posição dos eventos na grade de horas', () => {
  it('dá a largura toda a eventos que não se sobrepõem', () => {
    const layout = layoutDayEvents([{ id: 'a', startMinute: 480, endMinute: 540 }, { id: 'b', startMinute: 540, endMinute: 600 }])
    expect(layout).toEqual([{ id: 'a', column: 0, columnCount: 1 }, { id: 'b', column: 0, columnCount: 1 }])
  })

  it('divide a largura entre eventos sobrepostos e reaproveita a coluna que liberou', () => {
    const layout = layoutDayEvents([
      { id: 'long', startMinute: 480, endMinute: 660 },
      { id: 'first', startMinute: 500, endMinute: 560 },
      { id: 'second', startMinute: 570, endMinute: 620 },
    ])
    expect(layout).toEqual([
      { id: 'long', column: 0, columnCount: 2 },
      { id: 'first', column: 1, columnCount: 2 },
      { id: 'second', column: 1, columnCount: 2 },
    ])
  })
})
