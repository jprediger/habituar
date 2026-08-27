// Este teste não é sobre o app: é sobre o toolchain. O transform padrão do Vitest é
// esbuild, que não emite `design:paramtypes` — e sem essa metadata o container do Nest
// não resolve dependência por tipo, falhando em runtime sem apontar a linha. Se o SWC
// sair do caminho dos testes, é aqui que se descobre.
import 'reflect-metadata'
import { Injectable, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

@Injectable()
class Dependency {
  readonly value = 'injected'
}

@Injectable()
class Consumer {
  constructor(readonly dependency: Dependency) {}
}

@Module({ providers: [Dependency, Consumer] })
class ProbeModule {}

describe('container de injeção', () => {
  it('resolve uma dependência declarada apenas pelo tipo do parâmetro', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile()

    expect(moduleRef.get(Consumer).dependency.value).toBe('injected')
  })
})
