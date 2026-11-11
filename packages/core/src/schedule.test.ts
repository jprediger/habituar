import { describe, expect, it } from 'vitest'
import { localDateSchema } from './calendar.js'
import type { LocalDate } from './calendar.js'
import { expandOccurrences, isOccurrenceDate, nextOccurrenceDate, planScheduleSplit, scheduleSchema } from './schedule.js'
import type { OccurrenceException, Schedule, SplitOccurrence } from './schedule.js'

// 2026-11-09 é segunda-feira; "hoje" nos cenários é a quarta 2026-11-11.
const TODAY = day('2026-11-11')

function day(value: string): LocalDate {
  return localDateSchema.parse(value)
}

function schedule(value: unknown): Schedule {
  return scheduleSchema.parse(value)
}

function occurrence(originalDate: string, exception: OccurrenceException, isRecorded = false): SplitOccurrence {
  return { originalDate: day(originalDate), exception, isRecorded }
}

const AFTERNOON = { kind: 'timed', startsAt: '14:00', endsAt: '15:00' } as const
const MONDAYS_AND_WEDNESDAYS = schedule({ startsOn: '2026-10-05', time: AFTERNOON, recurrence: { kind: 'weekly', weekdays: [1, 3], until: null } })

describe('agenda de uma série', () => {
  it('aceita dia inteiro, horário no mesmo dia e as repetições que uma RRULE expressa', () => {
    expect(scheduleSchema.safeParse({ startsOn: '2026-11-11', time: { kind: 'all-day' }, recurrence: { kind: 'none' } }).success).toBe(true)
    expect(scheduleSchema.safeParse({ startsOn: '2026-11-11', time: AFTERNOON, recurrence: { kind: 'daily', until: '2026-11-30' } }).success).toBe(true)
    expect(scheduleSchema.safeParse({ startsOn: '2026-11-11', time: AFTERNOON, recurrence: { kind: 'weekly', weekdays: [3, 5], until: null } }).success).toBe(true)
  })

  it('recusa horário que não termina depois de começar', () => {
    expect(scheduleSchema.safeParse({ startsOn: '2026-11-11', time: { kind: 'timed', startsAt: '15:00', endsAt: '15:00' }, recurrence: { kind: 'none' } }).success).toBe(false)
    expect(scheduleSchema.safeParse({ startsOn: '2026-11-11', time: { kind: 'timed', startsAt: '15:00', endsAt: '09:00' }, recurrence: { kind: 'none' } }).success).toBe(false)
  })

  it('recusa término da repetição antes do início', () => {
    expect(scheduleSchema.safeParse({ startsOn: '2026-11-11', time: AFTERNOON, recurrence: { kind: 'daily', until: '2026-11-10' } }).success).toBe(false)
  })

  it('recusa o que uma RRULE não expressa sem ambiguidade', () => {
    // Início fora dos dias escolhidos: na RRULE o DTSTART conta como ocorrência mesmo assim.
    expect(scheduleSchema.safeParse({ startsOn: '2026-11-11', time: AFTERNOON, recurrence: { kind: 'weekly', weekdays: [1], until: null } }).success).toBe(false)
    expect(scheduleSchema.safeParse({ startsOn: '2026-11-11', time: AFTERNOON, recurrence: { kind: 'weekly', weekdays: [], until: null } }).success).toBe(false)
    expect(scheduleSchema.safeParse({ startsOn: '2026-11-11', time: AFTERNOON, recurrence: { kind: 'weekly', weekdays: [3, 3], until: null } }).success).toBe(false)
    expect(scheduleSchema.safeParse({ startsOn: '2026-11-11', time: AFTERNOON, recurrence: { kind: 'none', until: '2026-11-12' } }).success).toBe(false)
    expect(scheduleSchema.safeParse({ startsOn: '2026-11-11', time: AFTERNOON, recurrence: { kind: 'daily', until: null, interval: 2 } }).success).toBe(false)
  })
})

describe('datas de ocorrência', () => {
  it('reconhece só os dias do padrão, entre o início e o término', () => {
    const weekly = schedule({ startsOn: '2026-11-09', time: AFTERNOON, recurrence: { kind: 'weekly', weekdays: [1, 3], until: '2026-11-18' } })
    expect(isOccurrenceDate(weekly, day('2026-11-09'))).toBe(true)
    expect(isOccurrenceDate(weekly, day('2026-11-18'))).toBe(true)
    expect(isOccurrenceDate(weekly, day('2026-11-10'))).toBe(false)
    expect(isOccurrenceDate(weekly, day('2026-11-02'))).toBe(false)
    expect(isOccurrenceDate(weekly, day('2026-11-23'))).toBe(false)
  })

  it('acha a próxima ocorrência a partir de um dia, ou nenhuma depois do término', () => {
    const weekly = schedule({ startsOn: '2026-11-09', time: AFTERNOON, recurrence: { kind: 'weekly', weekdays: [1, 3], until: '2026-11-18' } })
    expect(nextOccurrenceDate(weekly, day('2026-11-01'))).toBe('2026-11-09')
    expect(nextOccurrenceDate(weekly, day('2026-11-12'))).toBe('2026-11-16')
    expect(nextOccurrenceDate(weekly, day('2026-11-19'))).toBeUndefined()
    const once = schedule({ startsOn: '2026-11-20', time: { kind: 'all-day' }, recurrence: { kind: 'none' } })
    expect(nextOccurrenceDate(once, day('2026-11-20'))).toBe('2026-11-20')
    expect(nextOccurrenceDate(once, day('2026-11-21'))).toBeUndefined()
  })
})

describe('expansão de ocorrências', () => {
  it('expande a repetição diária dentro do intervalo, respeitando início e término', () => {
    const daily = schedule({ startsOn: '2026-11-10', time: { kind: 'all-day' }, recurrence: { kind: 'daily', until: '2026-11-12' } })
    expect(expandOccurrences(daily, [], { from: day('2026-11-08'), to: day('2026-11-20') }).map(item => item.date)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12'])
  })

  it('expande a repetição semanal em vários dias da semana', () => {
    expect(expandOccurrences(MONDAYS_AND_WEDNESDAYS, [], { from: day('2026-11-09'), to: day('2026-11-22') }).map(item => item.date))
      .toEqual(['2026-11-09', '2026-11-11', '2026-11-16', '2026-11-18'])
  })

  it('tira a ocorrência cancelada e leva a remarcada para o novo dia e horário, mantendo a data original', () => {
    const moved = { kind: 'timed', startsAt: '16:00', endsAt: '17:00' } as const
    const items = expandOccurrences(MONDAYS_AND_WEDNESDAYS, [
      { originalDate: day('2026-11-09'), exception: { kind: 'cancelled' } },
      { originalDate: day('2026-11-11'), exception: { kind: 'moved', date: day('2026-11-12'), time: moved } },
      { originalDate: day('2026-11-16'), exception: { kind: 'none' } },
    ], { from: day('2026-11-09'), to: day('2026-11-16') })

    expect(items).toEqual([
      { originalDate: '2026-11-11', date: '2026-11-12', time: moved },
      { originalDate: '2026-11-16', date: '2026-11-16', time: AFTERNOON },
    ])
  })

  it('mostra a ocorrência remarcada para dentro do intervalo e esconde a remarcada para fora dele', () => {
    const range = { from: day('2026-11-16'), to: day('2026-11-17') }
    const items = expandOccurrences(MONDAYS_AND_WEDNESDAYS, [
      { originalDate: day('2026-11-11'), exception: { kind: 'moved', date: day('2026-11-17'), time: { kind: 'all-day' } } },
      { originalDate: day('2026-11-16'), exception: { kind: 'moved', date: day('2026-11-25'), time: AFTERNOON } },
    ], range)

    expect(items).toEqual([{ originalDate: '2026-11-11', date: '2026-11-17', time: { kind: 'all-day' } }])
  })

  it('ignora ajuste guardado para um dia que não é do padrão', () => {
    const items = expandOccurrences(MONDAYS_AND_WEDNESDAYS, [
      { originalDate: day('2026-11-10'), exception: { kind: 'moved', date: day('2026-11-10'), time: AFTERNOON } },
    ], { from: day('2026-11-10'), to: day('2026-11-10') })
    expect(items).toEqual([])
  })

  it('ordena o dia inteiro antes dos horários', () => {
    const items = expandOccurrences(MONDAYS_AND_WEDNESDAYS, [
      { originalDate: day('2026-11-09'), exception: { kind: 'moved', date: day('2026-11-11'), time: { kind: 'all-day' } } },
    ], { from: day('2026-11-11'), to: day('2026-11-11') })
    expect(items.map(item => item.originalDate)).toEqual(['2026-11-09', '2026-11-11'])
  })

  it('expande a tarefa avulsa só no próprio dia', () => {
    const once = schedule({ startsOn: '2026-11-20', time: AFTERNOON, recurrence: { kind: 'none' } })
    expect(expandOccurrences(once, [], { from: day('2026-11-01'), to: day('2026-11-30') }).map(item => item.date)).toEqual(['2026-11-20'])
    expect(expandOccurrences(once, [], { from: day('2026-11-21'), to: day('2026-11-30') })).toEqual([])
  })
})

describe('divisão de série a partir de uma ocorrência', () => {
  it('só muda o horário: a série antiga termina na véspera e os ajustes futuros passam para a nova', () => {
    const edit = schedule({ ...MONDAYS_AND_WEDNESDAYS, startsOn: '2026-11-11', time: { kind: 'timed', startsAt: '15:00', endsAt: '16:00' } })
    const plan = planScheduleSplit(MONDAYS_AND_WEDNESDAYS, [
      occurrence('2026-11-09', { kind: 'none' }, true),
      occurrence('2026-11-16', { kind: 'cancelled' }),
      occurrence('2026-11-18', { kind: 'moved', date: day('2026-11-19'), time: AFTERNOON }),
    ], TODAY, edit, TODAY)

    expect(plan).toEqual({
      kind: 'split',
      cut: '2026-11-11',
      previous: { ...MONDAYS_AND_WEDNESDAYS, recurrence: { kind: 'weekly', weekdays: [1, 3], until: '2026-11-10' } },
      next: edit,
      migrated: ['2026-11-16', '2026-11-18'],
      discarded: [],
    })
  })

  it('muda os dias: a série nova começa no primeiro dia escolhido e descarta o ajuste que não cabe', () => {
    const edit = schedule({ startsOn: '2026-11-12', time: AFTERNOON, recurrence: { kind: 'weekly', weekdays: [2, 4], until: null } })
    const plan = planScheduleSplit(MONDAYS_AND_WEDNESDAYS, [
      occurrence('2026-11-16', { kind: 'cancelled' }),
      occurrence('2026-11-18', { kind: 'moved', date: day('2026-11-19'), time: AFTERNOON }),
    ], TODAY, edit, TODAY)

    expect(plan).toMatchObject({ kind: 'split', cut: '2026-11-11', next: edit, migrated: [], discarded: ['2026-11-16', '2026-11-18'] })
  })

  it('a tarefa de hoje já está concluída: ela fica na série antiga e o corte avança para a ocorrência seguinte', () => {
    const edit = schedule({ ...MONDAYS_AND_WEDNESDAYS, startsOn: '2026-11-11', time: { kind: 'all-day' } })
    const plan = planScheduleSplit(MONDAYS_AND_WEDNESDAYS, [occurrence('2026-11-11', { kind: 'none' }, true)], TODAY, edit, TODAY)

    expect(plan).toEqual({
      kind: 'split',
      cut: '2026-11-16',
      previous: { ...MONDAYS_AND_WEDNESDAYS, recurrence: { kind: 'weekly', weekdays: [1, 3], until: '2026-11-15' } },
      next: { ...edit, startsOn: '2026-11-16' },
      migrated: [],
      discarded: [],
    })
  })

  it('um ajuste futuro não cabe mais na série nova: é descartado, e o que cabe é mantido', () => {
    const edit = schedule({ startsOn: '2026-11-16', time: AFTERNOON, recurrence: { kind: 'weekly', weekdays: [1], until: null } })
    const plan = planScheduleSplit(MONDAYS_AND_WEDNESDAYS, [
      occurrence('2026-11-18', { kind: 'moved', date: day('2026-11-20'), time: AFTERNOON }),
      occurrence('2026-11-23', { kind: 'cancelled' }),
    ], day('2026-11-16'), edit, TODAY)

    expect(plan).toMatchObject({ kind: 'split', cut: '2026-11-16', next: edit, migrated: ['2026-11-23'], discarded: ['2026-11-18'] })
  })

  it('a série com término antes do corte fica como está, e a edição vira uma série nova depois dele', () => {
    const daily = schedule({ startsOn: '2026-11-01', time: AFTERNOON, recurrence: { kind: 'daily', until: '2026-11-11' } })
    const edit = schedule({ startsOn: '2026-11-11', time: AFTERNOON, recurrence: { kind: 'daily', until: '2026-11-20' } })
    const plan = planScheduleSplit(daily, [occurrence('2026-11-11', { kind: 'none' }, true)], TODAY, edit, TODAY)

    expect(plan).toEqual({ kind: 'split', cut: '2026-11-12', previous: daily, next: { ...edit, startsOn: '2026-11-12' }, migrated: [], discarded: [] })
  })

  it('não muda nada quando nem a série antiga nem a edição têm ocorrência depois do corte', () => {
    const daily = schedule({ startsOn: '2026-11-01', time: AFTERNOON, recurrence: { kind: 'daily', until: '2026-11-11' } })
    expect(planScheduleSplit(daily, [occurrence('2026-11-11', { kind: 'none' }, true)], TODAY, daily, TODAY)).toEqual({ kind: 'unchanged', cut: '2026-11-12' })
  })

  it('registro numa ocorrência futura também conta como passado, e o corte pula para depois dele', () => {
    const daily = schedule({ startsOn: '2026-11-01', time: AFTERNOON, recurrence: { kind: 'daily', until: null } })
    const plan = planScheduleSplit(daily, [occurrence('2026-11-20', { kind: 'none' }, true)], day('2026-11-12'), daily, TODAY)
    expect(plan).toMatchObject({ kind: 'split', cut: '2026-11-21', previous: { recurrence: { kind: 'daily', until: '2026-11-20' } } })
  })

  it('nunca deixa registro depois do corte', () => {
    const recorded = [occurrence('2026-11-11', { kind: 'none' }, true), occurrence('2026-11-16', { kind: 'cancelled' }, true), occurrence('2026-11-18', { kind: 'none' })]
    const plan = planScheduleSplit(MONDAYS_AND_WEDNESDAYS, recorded, TODAY, MONDAYS_AND_WEDNESDAYS, TODAY)
    if (plan.kind !== 'split') throw new Error(`expected split, got ${plan.kind}`)
    expect(plan.cut).toBe('2026-11-18')
    expect(recorded.filter(item => item.isRecorded).every(item => item.originalDate < plan.cut)).toBe(true)
  })

  it('descarta a linha vazia depois do corte em vez de levá-la para a série nova', () => {
    const plan = planScheduleSplit(MONDAYS_AND_WEDNESDAYS, [occurrence('2026-11-16', { kind: 'none' })], TODAY, MONDAYS_AND_WEDNESDAYS, TODAY)
    expect(plan).toMatchObject({ kind: 'split', migrated: [], discarded: ['2026-11-16'] })
  })

  it('termina a série na véspera do corte quando não há edição', () => {
    const plan = planScheduleSplit(MONDAYS_AND_WEDNESDAYS, [occurrence('2026-11-16', { kind: 'cancelled' })], TODAY, null, TODAY)
    expect(plan).toEqual({
      kind: 'split',
      cut: '2026-11-11',
      previous: { ...MONDAYS_AND_WEDNESDAYS, recurrence: { kind: 'weekly', weekdays: [1, 3], until: '2026-11-10' } },
      next: null,
      migrated: [],
      discarded: ['2026-11-16'],
    })
  })

  it('reescreve a série no lugar quando o corte é a primeira ocorrência, mantendo os ajustes que cabem', () => {
    const fridays = schedule({ startsOn: '2026-11-13', time: AFTERNOON, recurrence: { kind: 'weekly', weekdays: [5], until: null } })
    const edit = schedule({ ...fridays, time: { kind: 'all-day' } })
    const plan = planScheduleSplit(fridays, [
      occurrence('2026-11-20', { kind: 'cancelled' }),
      occurrence('2026-11-27', { kind: 'moved', date: day('2026-11-28'), time: AFTERNOON }),
      occurrence('2026-12-04', { kind: 'none' }),
    ], day('2026-11-13'), edit, TODAY)

    expect(plan).toEqual({ kind: 'rewrite', cut: '2026-11-13', schedule: edit, kept: ['2026-11-20', '2026-11-27'], discarded: ['2026-12-04'] })
  })

  it('reescreve a tarefa avulsa futura com a data nova, mesmo antes da data antiga', () => {
    const once = schedule({ startsOn: '2026-11-20', time: AFTERNOON, recurrence: { kind: 'none' } })
    const edit = schedule({ ...once, startsOn: '2026-11-14' })
    expect(planScheduleSplit(once, [], day('2026-11-20'), edit, TODAY)).toEqual({ kind: 'rewrite', cut: '2026-11-20', schedule: edit, kept: [], discarded: [] })
  })

  it('remove a série inteira quando o corte é a primeira ocorrência e não há edição', () => {
    const fridays = schedule({ startsOn: '2026-11-13', time: AFTERNOON, recurrence: { kind: 'weekly', weekdays: [5], until: null } })
    expect(planScheduleSplit(fridays, [occurrence('2026-11-20', { kind: 'cancelled' })], day('2026-11-13'), null, TODAY)).toEqual({ kind: 'remove', cut: '2026-11-13' })
  })

  it('recusa corte antes de hoje: o passado só aceita mudança de uma ocorrência', () => {
    expect(planScheduleSplit(MONDAYS_AND_WEDNESDAYS, [], day('2026-11-09'), MONDAYS_AND_WEDNESDAYS, TODAY)).toEqual({ kind: 'refused', reason: 'cut-before-today' })
  })

  it('recusa corte num dia que não é ocorrência da série', () => {
    expect(planScheduleSplit(MONDAYS_AND_WEDNESDAYS, [], day('2026-11-12'), MONDAYS_AND_WEDNESDAYS, TODAY)).toEqual({ kind: 'refused', reason: 'not-an-occurrence' })
  })
})
