// @vitest-environment jsdom
import { studentProfileRevisionIdSchema, userIdSchema } from '@habituar/core/identity/ids'
import type { ConsultationInput, ObservationInput, StudentProfileInput, StudentProfileState } from '@habituar/core/student-records'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useConsultationForm, useObservationForm, useStudentProfileForm } from './student-record-forms.js'

const firstRevisionId = studentProfileRevisionIdSchema.parse('d1000000-0000-4000-8000-000000000001')
const latestRevisionId = studentProfileRevisionIdSchema.parse('d1000000-0000-4000-8000-000000000002')

function filledProfile(id = firstRevisionId): StudentProfileState {
  return {
    status: 'filled',
    revision: {
      id,
      schoolGrade: '5º ano',
      conditions: ['adhd'],
      supportNeeds: null,
      recordedAt: '2026-09-01T12:00:00.000Z',
      recordedBy: { id: userIdSchema.parse('d2000000-0000-4000-8000-000000000001'), name: 'Ana' },
    },
  }
}

function conflictError(): Error & { code: string; status: number } {
  return Object.assign(new Error('conflict'), { code: 'conflict', status: 409 })
}

describe('edição da ficha', () => {
  it('parte da revisão em tela e envia campo em branco como não informado', async () => {
    const save = vi.fn<(input: StudentProfileInput) => Promise<void>>(() => Promise.resolve())
    const { result } = renderHook(() => useStudentProfileForm({ profile: filledProfile(), save }))

    act(() => { result.current.startEditing() })
    act(() => { result.current.change('schoolGrade', '   ') })
    await act(() => result.current.submit())

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ schoolGrade: null, conditions: ['adhd'], basedOnRevisionId: firstRevisionId }))
    expect(result.current.isEditing).toBe(false)
  })

  it('aponta o campo inválido e não envia', async () => {
    const save = vi.fn(() => Promise.resolve())
    const { result } = renderHook(() => useStudentProfileForm({ profile: { status: 'empty' }, save }))

    act(() => { result.current.startEditing() })
    act(() => { result.current.change('schoolGrade', 'a'.repeat(81)) })
    await act(() => result.current.submit())

    expect(save).not.toHaveBeenCalled()
    expect(result.current.failure).toBe('invalid')
    expect([...result.current.invalidFields]).toEqual(['schoolGrade'])
  })

  it('guarda o rascunho num conflito e, no envio seguinte, parte da revisão atual', async () => {
    const save = vi.fn<(input: StudentProfileInput) => Promise<void>>(() => Promise.reject(conflictError()))
    const { result, rerender } = renderHook(({ profile }) => useStudentProfileForm({ profile, save }), {
      initialProps: { profile: filledProfile() },
    })

    act(() => { result.current.startEditing() })
    act(() => { result.current.setCondition('autism', true) })
    await act(() => result.current.submit())

    expect(result.current.failure).toBe('conflict')
    expect(result.current.isEditing).toBe(true)
    expect(result.current.values.conditions).toEqual(['adhd', 'autism'])

    save.mockImplementation(() => Promise.resolve())
    rerender({ profile: filledProfile(latestRevisionId) })
    await act(() => result.current.submit())

    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ basedOnRevisionId: latestRevisionId, conditions: ['adhd', 'autism'] }))
  })
})

describe('registro de consulta', () => {
  function fill(result: { current: ReturnType<typeof useConsultationForm> }): void {
    act(() => { result.current.change('occurredAt', '2026-09-01T14:30') })
    act(() => { result.current.change('durationMinutes', '50') })
    act(() => { result.current.change('notes', 'Trabalhamos a organização da semana.') })
  }

  it('converte a hora local digitada em instante e só grava depois da confirmação', async () => {
    const record = vi.fn<(input: ConsultationInput) => Promise<void>>(() => Promise.resolve())
    const { result } = renderHook(() => useConsultationForm({ record }))

    fill(result)
    act(() => { result.current.request() })
    expect(record).not.toHaveBeenCalled()
    await act(() => result.current.confirm())

    expect(record).toHaveBeenCalledWith({ occurredAt: new Date('2026-09-01T14:30').toISOString(), durationMinutes: 50, notes: 'Trabalhamos a organização da semana.' })
    expect(result.current.values.notes).toBe('')
  })

  it('aponta data e duração inválidas sem pedir confirmação', () => {
    const record = vi.fn<(input: ConsultationInput) => Promise<void>>(() => Promise.resolve())
    const { result } = renderHook(() => useConsultationForm({ record }))

    act(() => { result.current.change('durationMinutes', '12.5') })
    act(() => { result.current.change('notes', 'Anotação') })
    act(() => { result.current.request() })

    expect(result.current.isConfirming).toBe(false)
    expect([...result.current.invalidFields].sort()).toEqual(['durationMinutes', 'occurredAt'])
  })

  it('explica data no futuro e mantém o que foi digitado', async () => {
    const record = vi.fn<(input: ConsultationInput) => Promise<void>>(() => Promise.reject(Object.assign(new Error('future'), { code: 'consultation-in-future', status: 422 })))
    const { result } = renderHook(() => useConsultationForm({ record }))

    fill(result)
    act(() => { result.current.request() })
    await act(() => result.current.confirm())

    expect(result.current.failure).toBe('future')
    expect(result.current.values.notes).toBe('Trabalhamos a organização da semana.')
  })
})

describe('registro de observação', () => {
  it('só grava depois da confirmação explícita', async () => {
    const add = vi.fn<(input: ObservationInput) => Promise<void>>(() => Promise.resolve())
    const { result } = renderHook(() => useObservationForm({ add }))

    act(() => { result.current.setBody('Participou bem da atividade em grupo.') })
    act(() => { result.current.request() })
    expect(add).not.toHaveBeenCalled()
    expect(result.current.isConfirming).toBe(true)

    await act(() => result.current.confirm())
    expect(add).toHaveBeenCalledWith({ body: 'Participou bem da atividade em grupo.' })
    expect(result.current.body).toBe('')
    expect(result.current.isConfirming).toBe(false)
  })

  it('não pede confirmação para observação em branco', () => {
    const add = vi.fn(() => Promise.resolve())
    const { result } = renderHook(() => useObservationForm({ add }))

    act(() => { result.current.request() })

    expect(result.current.isConfirming).toBe(false)
    expect(result.current.failure).toBe('invalid')
  })

  it('mantém o texto quando a gravação falha', async () => {
    const add = vi.fn(() => Promise.reject(new Error('network')))
    const { result } = renderHook(() => useObservationForm({ add }))

    act(() => { result.current.setBody('Texto que não pode se perder.') })
    act(() => { result.current.request() })
    await act(() => result.current.confirm())

    expect(result.current.failure).toBe('server')
    expect(result.current.body).toBe('Texto que não pode se perder.')
  })
})
