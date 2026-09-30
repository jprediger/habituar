// @vitest-environment jsdom
import { membershipContextSchema } from '@habituar/core/auth/context'
import { consentIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createHabituarReactClient, listStudentHomeSections } from './react-client.js'

const ORIGIN = 'http://api.habituar.test'
const STUDENT_ID = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const CONSENT_ID = consentIdSchema.parse('40000000-0000-4000-8000-000000000001')
const STUDENT = { id: STUDENT_ID, fullName: 'Bruno Lima', socialName: null, birthDate: '2014-03-09', ageRange: '11-14', archivedAt: null }
const CONSENT = { id: CONSENT_ID, kind: 'guardian-confirmation', termVersion: '2026-01', guardianId: null, signedOn: null, recordedAt: '2026-09-30T12:00:00.000Z', revokedAt: null }

// API falsa com estado: confirmar e revogar mudam o que as duas listas devolvem, como no
// servidor, para o teste provar que o hook relê as duas depois de cada ação.
function createConsentApi(options: Readonly<{ isConfirmBroken?: boolean }> = {}) {
  let isConfirmed = false
  const writes: string[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    await Promise.resolve()
    const path = new URL(request.url).pathname
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (request.method === 'GET' && path === '/v1/me/consents/pending') return json(isConfirmed ? [] : [{ student: STUDENT, termVersion: '2026-01' }])
    if (request.method === 'GET' && path === '/v1/me/consents') return json(isConfirmed ? [{ student: STUDENT, consent: CONSENT }] : [])
    if (request.method === 'POST' && path === `/v1/me/consents/${STUDENT_ID}/confirm`) {
      writes.push(path)
      if (options.isConfirmBroken === true) return json({ defined: false, code: 'INTERNAL_SERVER_ERROR', status: 500, message: 'Internal server error' }, 500)
      isConfirmed = true
      return json(CONSENT)
    }
    if (request.method === 'POST' && path === `/v1/me/consents/${STUDENT_ID}/${CONSENT_ID}/revoke`) {
      writes.push(path)
      isConfirmed = false
      return json({ ...CONSENT, revokedAt: '2026-09-30T13:00:00.000Z' })
    }
    return json({ defined: true, code: 'not_found', status: 404, message: 'Not found' }, 404)
  }
  return { fetch, writes }
}

describe('consentimento do responsável', () => {
  it('confirma e move o estudante de pendente para confirmado', async () => {
    const api = createConsentApi()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useGuardianConsents(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.pending).toMatchObject({ status: 'ready', consents: [{ student: { id: STUDENT_ID } }] }) })
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.confirm(STUDENT_ID) })

    expect(outcome).toBe('saved')
    await waitFor(() => { expect(hook.result.current.pending).toEqual({ status: 'ready', consents: [] }) })
    expect(hook.result.current.confirmed).toMatchObject({ status: 'ready', consents: [{ consent: { id: CONSENT_ID } }] })
  })

  it('revoga pelo id da confirmação e devolve a pendência', async () => {
    const api = createConsentApi()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useGuardianConsents(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.pending.status).toBe('ready') })
    await act(async () => { await hook.result.current.confirm(STUDENT_ID) })
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.revoke(STUDENT_ID, CONSENT_ID) })

    expect(outcome).toBe('saved')
    expect(api.writes).toEqual([`/v1/me/consents/${STUDENT_ID}/confirm`, `/v1/me/consents/${STUDENT_ID}/${CONSENT_ID}/revoke`])
    await waitFor(() => { expect(hook.result.current.pending).toMatchObject({ status: 'ready', consents: [{ student: { id: STUDENT_ID } }] }) })
  })

  it('devolve falha sem lançar quando o envio não chega a gravar', async () => {
    const api = createConsentApi({ isConfirmBroken: true })
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useGuardianConsents(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.pending.status).toBe('ready') })
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.confirm(STUDENT_ID) })

    expect(outcome).toBe('not-saved')
    expect(hook.result.current.pending).toMatchObject({ status: 'ready', consents: [{ student: { id: STUDENT_ID } }] })
  })
})

describe('seções do ambiente de aluno', () => {
  function membership(templateKeys: readonly ('student' | 'guardian')[]) {
    return membershipContextSchema.parse({
      institution: { id: '00000000-0000-4000-8000-000000000001', name: 'Escola' },
      environment: 'student',
      roles: templateKeys.map((templateKey, index) => ({ id: `10000000-0000-4000-8000-00000000000${String(index + 1)}`, name: templateKey, templateKey })),
      permissions: [],
    })
  }

  it('mostra só o cadastro próprio a quem é aluno', () => {
    expect(listStudentHomeSections(membership(['student']))).toEqual({ showsOwnRecord: true, showsGuardianConsents: false, isGuardianToo: false })
  })

  it('mostra só os consentimentos a quem é responsável', () => {
    expect(listStudentHomeSections(membership(['guardian']))).toEqual({ showsOwnRecord: false, showsGuardianConsents: true, isGuardianToo: false })
  })

  it('mostra as duas coisas a quem é aluno e responsável', () => {
    expect(listStudentHomeSections(membership(['student', 'guardian']))).toEqual({ showsOwnRecord: true, showsGuardianConsents: true, isGuardianToo: true })
  })
})
