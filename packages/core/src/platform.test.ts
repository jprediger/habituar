import { describe, expect, it } from 'vitest'
import { institutionInputSchema } from './platform.js'

describe('institution registration', () => {
  it.each([
    ['cpf', '52998224725', true],
    ['cpf', '11111111111', false],
    ['cnpj', '11222333000181', true],
    ['cnpj', '11222333000182', false],
    ['cnpj', '00000000000000', false],
    ['cpf', '529.982.247-25', false],
  ])('validates %s document %s', (documentType, documentNumber, isValid) => {
    expect(institutionInputSchema.safeParse({
      name: 'North', documentType, documentNumber,
      contactName: 'Contact', contactEmail: 'contact@example.com', contactPhone: '51999999999',
    }).success).toBe(isValid)
  })
  it('rejects a CPF with a forged check digit', () => {
    expect(institutionInputSchema.safeParse({
      name: 'North', documentType: 'cpf', documentNumber: '52998224724',
      contactName: 'Contact', contactEmail: 'contact@example.com', contactPhone: '51999999999',
    }).success).toBe(false)
  })
})
