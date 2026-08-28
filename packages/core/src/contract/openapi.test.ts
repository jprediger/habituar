import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { describe, expect, it } from 'vitest'
import { API_VERSION, apiContract } from './api-contract'

// Zod4 fala Standard Schema, mas o gerador de OpenAPI só sabe ler JSON Schema a partir
// de um converter concreto -- sem ele, todo schema vira o genérico "unsupported".
const generator = new OpenAPIGenerator({ schemaConverters: [new ZodToJsonSchemaConverter()] })

describe('documento openapi', () => {
  it('mantém o openapi.json commitado igual ao que o contrato gera', async () => {
    const document = await generator.generate(apiContract, {
      info: { title: 'Habituar API', version: API_VERSION },
    })

    await expect(`${JSON.stringify(document, null, 2)}\n`).toMatchFileSnapshot('../../openapi.json')
  })
})
