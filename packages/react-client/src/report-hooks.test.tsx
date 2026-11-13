// @vitest-environment jsdom
import { membershipContextSchema } from '@habituar/core/auth/context'
import { reportFilterSchema, reportSchema } from '@habituar/core/reports'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createHabituarReactClient } from './react-client.js'

const ORIGIN = 'http://api.habituar.test'
const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
const STUDENT_ID = '30000000-0000-4000-8000-000000000001'
const TASK_ID = '50000000-0000-4000-8000-000000000001'
const filter = reportFilterSchema.parse({ institutionId: INSTITUTION_ID, from: '2026-11-01', to: '2026-11-05' })
const student = { id: STUDENT_ID, name: 'Aluna Teste', completed: 1, missed: 0, upcoming: 0, total: 1, completionRate: 100, byWeekday: [] }
const weekdays = [1, 2, 3, 4, 5, 6, 7].map(weekday => ({ weekday, completed: weekday === 1 ? 1 : 0, missed: 0, upcoming: 0, total: weekday === 1 ? 1 : 0, completionRate: weekday === 1 ? 100 : null }))
const report = reportSchema.parse({
  institution: { id: INSTITUTION_ID, name: 'Escola Teste' },
  range: { from: '2026-11-01', to: '2026-11-05' },
  generatedAt: '2026-11-13T13:00:00.000Z', timeZone: 'America/Sao_Paulo', today: '2026-11-13',
  summary: { completed: 1, missed: 0, upcoming: 0, total: 1, completionRate: 100 },
  byWeekday: weekdays, byDay: [], byKind: [], students: [{ ...student, byWeekday: weekdays }],
  activities: [{ studentId: STUDENT_ID, taskId: TASK_ID, title: 'Leitura', kind: 'study', origin: 'staff', originalDate: '2026-11-02', date: '2026-11-02', status: 'completed', evaluation: 'achieved' }],
})

function membership(permissions: readonly Readonly<{ key: 'report.read' | 'report.export'; scope: 'assigned' | 'institution' }>[]) {
  return membershipContextSchema.parse({
    institution: { id: INSTITUTION_ID, name: 'Escola Teste' },
    environment: 'professional', roles: [], permissions,
  })
}

describe('relatórios no cliente compartilhado', () => {
  it('busca indicadores com o filtro e exporta PDF apenas quando autorizado', async () => {
    const requests: Request[] = []
    const api = createHabituarReactClient({ origin: ORIGIN, fetch: async (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      if (request.method === 'POST') return Response.json({ filename: 'relatorio.pdf', mediaType: 'application/pdf', base64: 'JVBERi0xLjQK' })
      return Response.json(report)
    } })
    const grants = membership([{ key: 'report.read', scope: 'assigned' }, { key: 'report.export', scope: 'assigned' }])
    const hook = renderHook(() => api.useReport(grants, filter), { wrapper: api.Provider })
    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    expect(hook.result.current.canExport).toBe(true)
    let filename: string | undefined
    await act(async () => { filename = (await hook.result.current.exportPdf()).filename })
    expect(filename).toBe('relatorio.pdf')
    expect(requests.map(request => request.method)).toEqual(['GET', 'POST'])
    expect(new URL(requests[0]?.url ?? '').pathname).toBe(`/v1/institutions/${INSTITUTION_ID}/reports`)
  })

  it('não busca nem exporta relatórios sem report.read', async () => {
    const requests: Request[] = []
    const api = createHabituarReactClient({ origin: ORIGIN, fetch: async (input, init) => {
      requests.push(new Request(input, init))
      return Response.json(report)
    } })
    const hook = renderHook(() => api.useReport(membership([{ key: 'report.export', scope: 'assigned' }]), filter), { wrapper: api.Provider })
    expect(hook.result.current.canExport).toBe(false)
    await expect(hook.result.current.exportPdf()).rejects.toThrow()
    expect(requests).toHaveLength(0)
  })
})
