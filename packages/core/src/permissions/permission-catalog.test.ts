import { describe, expect, it } from 'vitest'
import { PERMISSION_CATALOG } from './permission-catalog.js'

describe('catálogo de permissões', () => {
  it('não repete a mesma chave duas vezes', () => {
    expect(new Set(PERMISSION_CATALOG).size).toBe(PERMISSION_CATALOG.length)
  })
})
