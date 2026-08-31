import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NestFactory } from '@nestjs/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const VALID_ENVIRONMENT = {
  NODE_ENV: 'test',
  APP_VERSION: '0.0.0-test',
  DATABASE_URL: 'postgresql://habituar_app:secret@localhost:5433/habituar',
}

describe('environment schema', () => {
  const originalWorkingDirectory = process.cwd()
  let hermeticWorkingDirectory: string

  beforeEach(() => {
    // O `ConfigModule` resolve o arquivo de ambiente a partir do cwd do processo. Sem um
    // cwd vazio, o `.env` local de quem roda a suíte reabastece a variável que o teste
    // apaga de propósito, e a prova vira falso negativo: verde no CI, vermelha na máquina
    // de quem seguiu o README. O ambiente do teste é só o que ele mesmo declara.
    hermeticWorkingDirectory = mkdtempSync(join(tmpdir(), 'habituar-environment-'))
    process.chdir(hermeticWorkingDirectory)

    vi.stubEnv('NODE_ENV', VALID_ENVIRONMENT.NODE_ENV)
    vi.stubEnv('APP_VERSION', VALID_ENVIRONMENT.APP_VERSION)
    vi.stubEnv('DATABASE_URL', VALID_ENVIRONMENT.DATABASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    process.chdir(originalWorkingDirectory)
    rmSync(hermeticWorkingDirectory, { recursive: true, force: true })
  })

  it('recusa iniciar sem DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', undefined)
    vi.resetModules()
    const { AppModule } = await import('../app.module.js')

    await expect(
      NestFactory.create(AppModule, { abortOnError: false, logger: false }),
    ).rejects.toThrow()
  })

  it('recusa iniciar com PORT não numérico', async () => {
    vi.stubEnv('PORT', 'not-a-port')
    vi.resetModules()
    const { AppModule } = await import('../app.module.js')

    await expect(
      NestFactory.create(AppModule, { abortOnError: false, logger: false }),
    ).rejects.toThrow()
  })
})
