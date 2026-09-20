// @vitest-environment jsdom
import { loginInputSchema } from '@habituar/core/auth/schema'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useValidatedForm } from './form.js'

// O envio real recebe um evento de formulário; o hook só precisa poder impedi-lo, então o
// teste passa o mínimo que o contrato exige em vez de encenar um evento de navegador.
const SUBMIT_EVENT = { preventDefault: () => undefined }

function renderLoginForm() {
  return renderHook(() => useValidatedForm(loginInputSchema, { email: '', password: '' }))
}

describe('validated form state', () => {
  it('stays quiet while a field is being filled in for the first time', () => {
    const { result } = renderLoginForm()

    act(() => {
      result.current.getField('email').setValue('person@')
    })

    expect(result.current.getField('email').error).toBeUndefined()
  })

  it('reports the failure once the person leaves the field', () => {
    const { result } = renderLoginForm()

    act(() => {
      result.current.getField('email').setValue('person@')
    })
    act(() => {
      result.current.getField('email').markVisited()
    })

    expect(result.current.getField('email').error).toEqual({ code: 'invalid-email' })
  })

  it('reveals every untouched field at once when submission is attempted', () => {
    const { result } = renderLoginForm()

    act(() => {
      result.current.handleSubmit(vi.fn())(SUBMIT_EVENT)
    })

    expect(result.current.getField('email').error).toBeDefined()
    expect(result.current.getField('password').error).toBeDefined()
  })

  it('refuses to hand an invalid form to the caller', () => {
    const { result } = renderLoginForm()
    const onValid = vi.fn()

    act(() => {
      result.current.handleSubmit(onValid)(SUBMIT_EVENT)
    })

    expect(onValid).not.toHaveBeenCalled()
  })

  it('hands over what was typed once the schema accepts it', () => {
    const { result } = renderLoginForm()
    const onValid = vi.fn()

    act(() => {
      result.current.getField('email').setValue('person@example.com')
    })
    act(() => {
      result.current.getField('password').setValue('secret')
    })
    act(() => {
      result.current.handleSubmit(onValid)(SUBMIT_EVENT)
    })

    expect(onValid).toHaveBeenCalledTimes(1)
    expect(result.current.getField('email').value).toBe('person@example.com')
  })
})
