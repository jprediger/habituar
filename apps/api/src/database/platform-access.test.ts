import 'reflect-metadata'
import { mobileSessionIssuedSchema } from '@habituar/core/auth/schema'
import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest'

describe('acesso às rotas de plataforma', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  const ownerPool = new Pool({ connectionString: migrationUrl })
  let app: INestApplication | undefined
  let baseUrl: string

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_VERSION', '0.0.0-test')
    vi.stubEnv('DATABASE_URL', applicationUrl)
    const { AppModule } = await import('../app.module.js')
    app = await NestFactory.create(AppModule, { logger: false })
    app.use(cookieParser())
    await app.listen(0)
    baseUrl = await app.getUrl()
  })

  afterAll(async () => {
    if (app !== undefined) await app.close()
    await ownerPool.end()
    vi.unstubAllEnvs()
  })

  async function registerAndLogin(email: string): Promise<string> {
    const registration = await fetch(`${baseUrl}/v1/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, name: email, password: 'password123' }),
    })
    expect(registration.status).toBe(200)
    const login = await fetch(`${baseUrl}/v1/auth/mobile/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    })
    expect(login.status).toBe(200)
    return mobileSessionIssuedSchema.parse(await login.json()).sessionToken
  }

  it('nega a listagem a usuário comum e permite ao administrador geral', async () => {
    const ordinary = await registerAndLogin('platform-ordinary@example.test')
    const denied = await fetch(`${baseUrl}/v1/platform/institutions`, { headers: { authorization: `Bearer ${ordinary}` } })
    expect(denied.status).toBe(403)

    const administratorEmail = 'platform-administrator@example.test'
    const administrator = await registerAndLogin(administratorEmail)
    await ownerPool.query('update users set is_platform_administrator = true where email = $1', [administratorEmail])
    const allowed = await fetch(`${baseUrl}/v1/platform/institutions`, { headers: { authorization: `Bearer ${administrator}` } })
    expect(allowed.status).toBe(200)
    expect(await allowed.json()).toEqual(expect.any(Array))
  })
})
