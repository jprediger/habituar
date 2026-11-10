import { describe, expect, it } from 'vitest'
import { appointmentInputSchema, appointmentSchema, expandAppointmentOccurrences, isAppointmentOccurrenceDate } from './appointments.js'
import { localDateSchema } from './calendar.js'

const input = { startsOn: '2026-11-09', startsAt: '14:00', durationMinutes: 50, notes: null, recurrence: { kind: 'none' } }

function appointment(overrides: Readonly<Record<string, unknown>>) {
  return appointmentSchema.parse({
    ...input,
    id: 'f1000000-0000-4000-8000-000000000001',
    studentId: 'f2000000-0000-4000-8000-000000000001',
    studentName: 'Ana',
    professionalUserId: 'f3000000-0000-4000-8000-000000000001',
    professionalName: 'Paula',
    cancelledOccurrences: [],
    version: 1,
    updatedAt: '2026-11-01T12:00:00.000Z',
    ...overrides,
  })
}

const november = { from: localDateSchema.parse('2026-11-01'), to: localDateSchema.parse('2026-11-30') }

describe('atendimento agendado', () => {
  it('aceita um atendimento avulso com dia, horário e duração', () => {
    expect(appointmentInputSchema.safeParse(input).success).toBe(true)
  })

  it('recusa atendimento que passa da meia-noite', () => {
    expect(appointmentInputSchema.safeParse({ ...input, startsAt: '23:30', durationMinutes: 60 }).success).toBe(false)
  })

  it('recusa repetição que termina antes do primeiro atendimento', () => {
    expect(appointmentInputSchema.safeParse({ ...input, recurrence: { kind: 'weekly', until: '2026-11-01' } }).success).toBe(false)
  })

  it('recusa duração fora dos limites', () => {
    expect(appointmentInputSchema.safeParse({ ...input, durationMinutes: 2 }).success).toBe(false)
    expect(appointmentInputSchema.safeParse({ ...input, durationMinutes: 600 }).success).toBe(false)
  })
})

describe('ocorrências de um atendimento', () => {
  it('mostra o avulso só no próprio dia, com o horário de término calculado', () => {
    const occurrences = expandAppointmentOccurrences(appointment({}), november)
    expect(occurrences.map(occurrence => [occurrence.date, occurrence.startsAt, occurrence.endsAt])).toEqual([['2026-11-09', '14:00', '14:50']])
  })

  it('repete toda semana até o fim do intervalo quando não tem término', () => {
    const occurrences = expandAppointmentOccurrences(appointment({ recurrence: { kind: 'weekly', until: null } }), november)
    expect(occurrences.map(occurrence => occurrence.date)).toEqual(['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'])
  })

  it('para na data de término da repetição', () => {
    const occurrences = expandAppointmentOccurrences(appointment({ recurrence: { kind: 'weekly', until: '2026-11-20' } }), november)
    expect(occurrences.map(occurrence => occurrence.date)).toEqual(['2026-11-09', '2026-11-16'])
  })

  it('começa no primeiro dia da série dentro de um intervalo que corta a série no meio', () => {
    const series = appointment({ startsOn: '2026-10-05', recurrence: { kind: 'weekly', until: null } })
    expect(expandAppointmentOccurrences(series, november).map(occurrence => occurrence.date)[0]).toBe('2026-11-02')
  })

  it('esconde a ocorrência cancelada sem afetar as outras', () => {
    const series = appointment({ recurrence: { kind: 'weekly', until: null }, cancelledOccurrences: ['2026-11-16'] })
    expect(expandAppointmentOccurrences(series, november).map(occurrence => occurrence.date)).toEqual(['2026-11-09', '2026-11-23', '2026-11-30'])
  })

  it('reconhece só os dias que pertencem à série', () => {
    const series = appointment({ recurrence: { kind: 'weekly', until: '2026-11-23' } })
    expect(isAppointmentOccurrenceDate(series, localDateSchema.parse('2026-11-16'))).toBe(true)
    expect(isAppointmentOccurrenceDate(series, localDateSchema.parse('2026-11-17'))).toBe(false)
    expect(isAppointmentOccurrenceDate(series, localDateSchema.parse('2026-11-02'))).toBe(false)
    expect(isAppointmentOccurrenceDate(series, localDateSchema.parse('2026-11-30'))).toBe(false)
  })
})
