import { describe, expect, it } from 'vitest'
import { consultationInputSchema, listChangedProfileFields, observationInputSchema, studentProfileInputSchema, studentProfileSchema } from './student-records.js'
import type { StudentProfile } from './student-records.js'

const EMPTY_PROFILE: StudentProfile = {
  schoolGrade: null,
  conditions: [],
  supportNeeds: null,
}

describe('ficha do estudante', () => {
  it('aceita uma ficha com os campos opcionais em branco', () => {
    expect(studentProfileInputSchema.safeParse({ ...EMPTY_PROFILE, basedOnRevisionId: null }).success).toBe(true)
  })

  it('recusa texto vazio no lugar de campo não informado', () => {
    expect(studentProfileSchema.safeParse({ ...EMPTY_PROFILE, schoolGrade: '   ' }).success).toBe(false)
  })

  it('recusa condição fora do catálogo e condição repetida', () => {
    expect(studentProfileSchema.safeParse({ ...EMPTY_PROFILE, conditions: ['diagnóstico livre'] }).success).toBe(false)
    expect(studentProfileSchema.safeParse({ ...EMPTY_PROFILE, conditions: ['adhd', 'adhd'] }).success).toBe(false)
  })

  it('recusa campo de cadastro, que pertence ao aluno e não à ficha', () => {
    expect(studentProfileSchema.safeParse({ ...EMPTY_PROFILE, birthDate: '2014-02-28' }).success).toBe(false)
  })

  it('recusa observação em branco ou acima do limite', () => {
    expect(observationInputSchema.safeParse({ body: '  ' }).success).toBe(false)
    expect(observationInputSchema.safeParse({ body: 'a'.repeat(4001) }).success).toBe(false)
  })
})

describe('registro de consulta', () => {
  const valid = { occurredAt: '2026-09-28T14:30:00-03:00', durationMinutes: 50, notes: 'Trabalhamos organização da semana.' }

  it('aceita instante com fuso, duração inteira e anotação', () => {
    expect(consultationInputSchema.safeParse(valid).success).toBe(true)
  })

  it('recusa instante sem fuso, que seria ambíguo entre quem digitou e o servidor', () => {
    expect(consultationInputSchema.safeParse({ ...valid, occurredAt: '2026-09-28T14:30:00' }).success).toBe(false)
  })

  it('recusa duração fracionada, zerada ou acima de oito horas', () => {
    for (const durationMinutes of [30.5, 0, 481]) {
      expect(consultationInputSchema.safeParse({ ...valid, durationMinutes }).success).toBe(false)
    }
  })

  it('recusa consulta sem anotação', () => {
    expect(consultationInputSchema.safeParse({ ...valid, notes: '   ' }).success).toBe(false)
  })
})

describe('campos alterados por uma revisão', () => {
  it('na primeira revisão, conta só o que foi preenchido', () => {
    expect(listChangedProfileFields(undefined, { ...EMPTY_PROFILE, schoolGrade: '5º ano', conditions: ['adhd'] })).toEqual([
      'schoolGrade',
      'conditions',
    ])
  })

  it('não trata a reordenação das condições como mudança', () => {
    const previous = { ...EMPTY_PROFILE, conditions: ['adhd', 'autism'] as const }
    expect(listChangedProfileFields(previous, { ...previous, conditions: ['autism', 'adhd'] })).toEqual([])
  })

  it('aponta campo apagado e campo alterado', () => {
    const previous = { ...EMPTY_PROFILE, schoolGrade: '5º ano', supportNeeds: 'Tempo extra em provas' }
    expect(listChangedProfileFields(previous, { ...previous, schoolGrade: '6º ano', supportNeeds: null })).toEqual([
      'schoolGrade',
      'supportNeeds',
    ])
  })
})
