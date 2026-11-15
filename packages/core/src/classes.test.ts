import { describe, expect, it } from 'vitest'
import {
  classDetailSchema, createClassInputSchema, listClassesInputSchema, updateClassInputSchema,
} from './classes.js'

const institutionId = '93000000-0000-4000-8000-000000000009'
const classId = '94000000-0000-4000-8000-000000000009'

describe('contratos de turmas', () => {
  it('normaliza nomes e valida limites', () => {
    expect(createClassInputSchema.parse({ institutionId, name: ' Turma A ', description: null }).name).toBe('Turma A')
    expect(createClassInputSchema.safeParse({ institutionId, name: '', description: null }).success).toBe(false)
    expect(createClassInputSchema.safeParse({ institutionId, name: 'x'.repeat(101), description: null }).success).toBe(false)
    expect(createClassInputSchema.safeParse({ institutionId, name: 'A', description: null, extra: 'no' }).success).toBe(false)
  })

  it('exige versão positiva em edições e UUID válido', () => {
    expect(updateClassInputSchema.safeParse({ institutionId, classId, name: 'Turma B', description: null, expectedVersion: 0 }).success).toBe(false)
    expect(updateClassInputSchema.safeParse({ institutionId, classId: 'abc', name: 'Turma B', description: null, expectedVersion: 1 }).success).toBe(false)
    expect(updateClassInputSchema.safeParse({ institutionId, classId, name: 'Turma B', description: null, expectedVersion: 1 }).success).toBe(true)
  })

  it('interpreta corretamente o archived=false da URL', () => {
    expect(listClassesInputSchema.parse({ institutionId, archived: 'false' }).archived).toBe(false)
    expect(listClassesInputSchema.parse({ institutionId, archived: 'true' }).archived).toBe(true)
  })

  it('recusa histórico de matrículas incompleto', () => {
    const result = classDetailSchema.safeParse({ id: classId, name: 'A', description: null, version: 1, archivedAt: null, studentCount: 0, staffCount: 0, enrollments: [{ studentId: classId, name: 'Aluno', enrolledAt: '2026-11-15T10:00:00.000Z' }], staff: [] })
    expect(result.success).toBe(false)
  })
})
