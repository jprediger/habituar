// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticationFailure, AuthenticationState } from './react-client.js'
import type { LoginAuthentication } from './login-form.js'
import { useLoginForm } from './login-form.js'

function createAuthentication(state: AuthenticationState): LoginAuthentication {
  return {
    state,
    actions: {
      login: vi.fn(() => Promise.resolve()),
      register: vi.fn(() => Promise.resolve()),
      logout: vi.fn(() => Promise.resolve()),
      selectMembership: vi.fn(() => Promise.resolve()),
      retry: vi.fn(() => Promise.resolve()),
    },
  }
}

function renderLoginForm(state: AuthenticationState = { status: 'unauthenticated' }) {
  const authentication = createAuthentication(state)
  const hook = renderHook((current: LoginAuthentication) => useLoginForm(current), {
    initialProps: authentication,
  })

  return { ...hook, authentication }
}

function fillValidCredentials(result: { current: ReturnType<typeof useLoginForm> }): void {
  act(() => {
    result.current.getField('email').setValue('person@example.com')
  })
  act(() => {
    result.current.getField('password').setValue('secret')
  })
}

function failedWith(failure: AuthenticationFailure): AuthenticationState {
  return { status: 'failed', failure }
}

describe('sign-in form', () => {
  it('never sends an incomplete form to the api', () => {
    const { result, authentication } = renderLoginForm()

    act(() => {
      result.current.submit()
    })

    expect(authentication.actions.login).not.toHaveBeenCalled()
  })

  it('sends exactly what was typed once the schema accepts it', () => {
    const { result, authentication } = renderLoginForm()

    fillValidCredentials(result)
    act(() => {
      result.current.submit()
    })

    expect(authentication.actions.login).toHaveBeenCalledWith({
      email: 'person@example.com',
      password: 'secret',
    })
  })

  it('reports that it is submitting while the session is being authenticated', () => {
    const { result } = renderLoginForm({ status: 'authenticating' })

    expect(result.current.isSubmitting).toBe(true)
  })
})

describe('which failure the screen shows', () => {
  it('shows the failure of the attempt that was just sent', () => {
    const { result, rerender } = renderLoginForm()

    fillValidCredentials(result)
    act(() => {
      result.current.submit()
    })
    rerender(createAuthentication(failedWith('invalid-credentials')))

    expect(result.current.failure).toBe('invalid-credentials')
  })

  it('stops blaming the credentials once the person corrects them', () => {
    const { result, rerender } = renderLoginForm()

    fillValidCredentials(result)
    act(() => {
      result.current.submit()
    })
    rerender(createAuthentication(failedWith('invalid-credentials')))
    act(() => {
      result.current.getField('password').setValue('another-secret')
    })

    expect(result.current.failure).toBeUndefined()
  })

  it('keeps the failure while the credentials are the ones that were sent', () => {
    const { result, rerender } = renderLoginForm()

    fillValidCredentials(result)
    act(() => {
      result.current.submit()
    })
    rerender(createAuthentication(failedWith('invalid-credentials')))
    act(() => {
      result.current.getField('email').markVisited()
    })

    expect(result.current.failure).toBe('invalid-credentials')
  })

  it('keeps a failure that no attempt from this form produced', () => {
    // `no-memberships` nasce da restauração da sessão, com token já gravado: some ao
    // digitar seria esconder o único aviso que a pessoa recebe.
    const { result } = renderLoginForm(failedWith('no-memberships'))

    act(() => {
      result.current.getField('email').setValue('person@example.com')
    })

    expect(result.current.failure).toBe('no-memberships')
  })
})
