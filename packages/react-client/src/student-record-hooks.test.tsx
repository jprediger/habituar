// @vitest-environment jsdom
import { membershipContextSchema } from '@habituar/core/auth/context'
import { studentIdSchema } from '@habituar/core/identity/ids'
import { studentConsultationSchema, studentRecordSchema } from '@habituar/core/student-records'
import { studentDetailSchema } from '@habituar/core/students'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createHabituarReactClient } from './react-client.js'

const ORIGIN = 'http://api.habituar.test'
const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
const STUDENT_ID = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const STUDENT_PATH = `/v1/institutions/${INSTITUTION_ID}/students/${STUDENT_ID}`
const AUTHOR = { id: '20000000-0000-4000-8000-000000000002', name: 'Ana Souza' }

function student(archivedAt: string | null) {
  return studentDetailSchema.parse({
    id: STUDENT_ID,
    fullName: 'Bruno Lima',
    socialName: null,
    birthDate: '2014-03-09',
    ageRange: '11-14',
    archivedAt,
    version: 1,
    guardians: [],
    assignments: [],
    consentStatus: 'institution-recorded',
    accountStatus: 'none',
    institutionalDocumentName: null,
    institutionalDocumentId: null,
  })
}

const RECORD = studentRecordSchema.parse({ studentId: STUDENT_ID, profile: { status: 'empty' } })
const CONSULTATION = studentConsultationSchema.parse({
  id: '60000000-0000-4000-8000-000000000001',
  occurredAt: '2026-09-03T17:00:00.000Z',
  durationMinutes: 50,
  notes: 'Montamos juntos a agenda de estudos da semana.',
  recordedAt: '2026-09-03T18:00:00.000Z',
  recordedBy: AUTHOR,
})

const membership = membershipContextSchema.parse({
  institution: { id: INSTITUTION_ID, name: 'Escola' },
  environment: 'professional',
  roles: [],
  permissions: [{ key: 'record.read', scope: 'assigned' }, { key: 'record.write', scope: 'assigned' }],
})

/** API falsa da ficha que anota cada leitura, para o teste dizer o que cada tela buscou. */
function createRecordApi(options: Readonly<{ archivedAt?: string | null }> = {}) {
  const reads: string[] = []
  const consultations = [CONSULTATION]
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    await Promise.resolve()
    const path = new URL(request.url).pathname
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (request.method === 'GET') reads.push(path.slice(STUDENT_PATH.length) || '/')
    if (request.method === 'GET' && path === STUDENT_PATH) return json(student(options.archivedAt ?? null))
    if (request.method === 'GET' && path === `${STUDENT_PATH}/record`) return json(RECORD)
    if (request.method === 'GET' && path === `${STUDENT_PATH}/record/history`) return json([])
    if (request.method === 'GET' && path === `${STUDENT_PATH}/record/consultations`) return json(consultations)
    if (request.method === 'POST' && path === `${STUDENT_PATH}/record/consultations`) {
      const recorded = studentConsultationSchema.parse({ ...CONSULTATION, id: '60000000-0000-4000-8000-000000000002', notes: 'Revisamos a rotina.' })
      consultations.unshift(recorded)
      return json(recorded)
    }
    return json({ defined: true, code: 'not_found', status: 404, message: 'Not found' }, 404)
  }
  return { fetch, reads }
}

describe('ficha do estudante por seção', () => {
  it('abre a entrada da ficha sem buscar consultas nem histórico', async () => {
    const api = createRecordApi()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useStudentRecordOverview(membership, STUDENT_ID), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.record.status).toBe('ready') })
    expect(hook.result.current.canWrite).toBe(true)
    expect([...api.reads].sort()).toEqual(['/', '/record'])
  })

  it('mostra as consultas e devolve a lista atualizada depois de registrar uma nova', async () => {
    const api = createRecordApi()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useStudentConsultations(membership, STUDENT_ID), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.consultations.status).toBe('ready') })
    expect(api.reads).not.toContain('/record/history')
    await act(() => hook.result.current.recordConsultation({ occurredAt: '2026-09-10T17:00:00.000Z', durationMinutes: 45, notes: 'Revisamos a rotina.' }))

    await waitFor(() => {
      const { consultations } = hook.result.current
      expect(consultations.status === 'ready' ? consultations.consultations.map((entry) => entry.notes) : []).toEqual(['Revisamos a rotina.', CONSULTATION.notes])
    })
  })

  it('deixa consultas e histórico de um aluno arquivado só para leitura, mesmo para quem escreve na ficha', async () => {
    const api = createRecordApi({ archivedAt: '2026-09-20T12:00:00.000Z' })
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => ({
      consultations: client.useStudentConsultations(membership, STUDENT_ID),
      history: client.useStudentHistory(membership, STUDENT_ID),
    }), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.history.history.status).toBe('ready') })
    await waitFor(() => { expect(api.reads).toContain('/') })
    expect(hook.result.current.consultations.canWrite).toBe(false)
    expect(hook.result.current.history.canWrite).toBe(false)
  })
})
