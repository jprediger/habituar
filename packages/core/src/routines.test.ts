import { describe, expect, it } from 'vitest'
import { weekdayOf, groupRoutineByWeekday, routineBlockInputSchema, routineBlockSchema } from './routines.js'

const valid = { weekday: 1, startsAt: '08:00', endsAt: '09:30', title: 'Aula de matemática', kind: 'class', notes: null }

function block(overrides: Readonly<Record<string, unknown>>) {
  return routineBlockSchema.parse({ ...valid, id: 'e1000000-0000-4000-8000-000000000001', version: 1, updatedAt: '2026-09-30T12:00:00.000Z', ...overrides })
}

describe('bloco da rotina', () => {
  it('aceita um bloco com dia, horário, título e tipo', () => {
    expect(routineBlockInputSchema.safeParse(valid).success).toBe(true)
  })

  it('recusa bloco que termina antes ou na mesma hora em que começa', () => {
    expect(routineBlockInputSchema.safeParse({ ...valid, endsAt: '08:00' }).success).toBe(false)
    expect(routineBlockInputSchema.safeParse({ ...valid, endsAt: '07:00' }).success).toBe(false)
  })

  it('recusa horário fora de HH:MM, dia fora da semana e tipo fora do catálogo', () => {
    expect(routineBlockInputSchema.safeParse({ ...valid, startsAt: '8:00' }).success).toBe(false)
    expect(routineBlockInputSchema.safeParse({ ...valid, endsAt: '24:00' }).success).toBe(false)
    expect(routineBlockInputSchema.safeParse({ ...valid, weekday: 8 }).success).toBe(false)
    expect(routineBlockInputSchema.safeParse({ ...valid, kind: 'recreio' }).success).toBe(false)
  })

  it('recusa título em branco', () => {
    expect(routineBlockInputSchema.safeParse({ ...valid, title: '   ' }).success).toBe(false)
  })
})

describe('semana da rotina', () => {
  it('devolve os sete dias, com os blocos de cada um em ordem de início', () => {
    const week = groupRoutineByWeekday([
      block({ id: 'e1000000-0000-4000-8000-000000000002', weekday: 1, startsAt: '14:00', endsAt: '15:00' }),
      block({ id: 'e1000000-0000-4000-8000-000000000003', weekday: 1, startsAt: '08:00', endsAt: '09:00' }),
      block({ id: 'e1000000-0000-4000-8000-000000000004', weekday: 3, startsAt: '10:00', endsAt: '11:00' }),
    ])

    expect(week.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(week[0]?.blocks.map((entry) => entry.startsAt)).toEqual(['08:00', '14:00'])
    expect(week[1]?.blocks).toEqual([])
    expect(week[2]?.blocks).toHaveLength(1)
  })
})

describe('dia da semana', () => {
  it('numera segunda como 1 e domingo como 7', () => {
    expect(weekdayOf(new Date(2026, 8, 28))).toBe(1)
    expect(weekdayOf(new Date(2026, 9, 4))).toBe(7)
  })
})
