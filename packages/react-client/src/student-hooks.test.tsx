// @vitest-environment jsdom
import { institutionIdSchema } from '@habituar/core/identity/ids'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createHabituarReactClient } from './react-client.js'

const INSTITUTION_ID = institutionIdSchema.parse('ca4a057e-7417-48a5-ade3-bd8ff83e2f78')

describe('student list transport', () => {
  it('loads an empty student list without sending the default archived filter', async () => {
    const requests: URL[] = []
    const fetch: typeof globalThis.fetch = (input, init) => {
      const url = new URL(new Request(input, init).url)
      requests.push(url)
      if (url.searchParams.has('archived')) return Promise.resolve(Response.json({ code: 'BAD_REQUEST' }, { status: 400 }))
      return Promise.resolve(Response.json({ items: [], total: 0, page: 1, pageSize: 20 }))
    }
    const client = createHabituarReactClient({ origin: 'http://api.habituar.test', fetch })
    const { result } = renderHook(() => client.useStudentList(INSTITUTION_ID))

    await waitFor(() => { expect(result.current.state.status).toBe('ready') })
    expect(result.current.state).toEqual({ status: 'ready', items: [], total: 0, page: 1, pageSize: 20 })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.pathname).toBe(`/v1/institutions/${INSTITUTION_ID}/students`)
    expect(requests[0]?.searchParams.has('archived')).toBe(false)
  })
})
