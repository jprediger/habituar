// @vitest-environment jsdom
import { membershipContextSchema } from '@habituar/core/auth/context'
import { classReportFilterSchema, classReportSchema } from '@habituar/core/reports'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createHabituarReactClient } from './react-client.js'

const institutionId = '00000000-0000-4000-8000-000000000001'
const classId = '20000000-0000-4000-8000-000000000001'
const filter = classReportFilterSchema.parse({ institutionId, classId, from: '2026-10-01', to: '2026-10-30' })
const report = classReportSchema.parse({
  institution: { id: institutionId, name: 'Escola Aurora' },
  class: { id: classId, name: 'Turma A' }, range: { from: filter.from, to: filter.to },
  generatedAt: '2026-11-15T15:00:00.000Z', timeZone: 'America/Sao_Paulo',
  privacy: { protected: true, minimumContributors: 3 }, summary: null,
})
function membership(permissions: readonly Readonly<{ key: 'class.read' | 'report.read' | 'report.export'; scope: 'assigned' | 'institution' }>[]) {
  return membershipContextSchema.parse({ institution: { id: institutionId, name: 'Escola Aurora' }, environment: 'professional', roles: [], permissions })
}

describe('hooks do relatório coletivo', () => {
  it('não faz requisição sem as duas permissões', () => {
    const fetch = vi.fn(() => Promise.resolve(Response.json(report)))
    const api = createHabituarReactClient({ origin: 'http://api.habituar.test', fetch })
    const hook = renderHook(() => api.useClassReport(membership([{ key: 'class.read', scope: 'assigned' }]), filter), { wrapper: api.Provider })
    expect(hook.result.current.state).toEqual({ status: 'failed', failure: 'forbidden' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('permite somente consulta sem report.export, sem expor a lista de alunos', async () => {
    const fetch = vi.fn(() => Promise.resolve(Response.json(report)))
    const api = createHabituarReactClient({ origin: 'http://api.habituar.test', fetch })
    const grants = membership([{ key: 'class.read', scope: 'assigned' }, { key: 'report.read', scope: 'assigned' }])
    const hook = renderHook(() => api.useClassReport(grants, filter), { wrapper: api.Provider })
    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    expect(hook.result.current.canExport).toBe(false)
    expect(JSON.stringify(hook.result.current.state)).not.toContain('students')
    await act(async () => { await expect(hook.result.current.exportPdf()).rejects.toThrow('not permitted') })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
