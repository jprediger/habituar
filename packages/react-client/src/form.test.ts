import { loginInputSchema, registerInputSchema } from '@habituar/core/auth/schema'
import { describe, expect, it } from 'vitest'
import { getFieldErrors } from './form.js'

describe('form validation driven by the API schema', () => {
  it('reports an empty required field as something to fill in', () => {
    expect(getFieldErrors(loginInputSchema, { email: '', password: '' }).password).toEqual({
      code: 'required',
    })
  })

  it('tells a malformed address apart from a missing one', () => {
    expect(getFieldErrors(loginInputSchema, { email: 'person@', password: 'secret' }).email).toEqual({
      code: 'invalid-email',
    })
  })

  it('carries the minimum length the API demands, instead of restating it in the screen', () => {
    expect(getFieldErrors(registerInputSchema, { name: 'Person', email: 'person@example.com', password: 'short' }).password).toEqual({
      code: 'too-short',
      minimum: 8,
    })
  })

  it('reports nothing for input the API would accept', () => {
    expect(
      getFieldErrors(registerInputSchema, {
        name: 'Person',
        email: 'person@example.com',
        password: 'long-enough',
      }),
    ).toEqual({})
  })

  it('keeps the login and register rules in step by reading the same schemas', () => {
    // Senha de 5 caracteres entra no login (min 1) e é recusada no cadastro (min 8): a
    // diferença é do contrato, e a tela não pode inventar uma terceira regra.
    expect(getFieldErrors(loginInputSchema, { email: 'person@example.com', password: 'short' })).toEqual({})
    expect(
      getFieldErrors(registerInputSchema, { name: 'Person', email: 'person@example.com', password: 'short' }).password,
    ).toBeDefined()
  })
})
