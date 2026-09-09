import 'reflect-metadata'
import { authenticationContextSchema } from '@habituar/core/auth/context'
import { authenticatedUserSchema, mobileSessionIssuedSchema } from '@habituar/core/auth/schema'
import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest'
import { createAuthenticationContextFixtures } from '../database/authentication-context-fixture.js'

describe('authenticated context', () => {
  let applicationUrl: string
  const databaseUrls = inject('databaseUrls')
  let app: INestApplication | undefined

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_VERSION', '0.0.0-test')
    vi.stubEnv('DATABASE_URL', databaseUrls.applicationUrl)
    const { AppModule } = await import('../app.module.js')
    app = await NestFactory.create(AppModule, { logger: false })
    app.use(cookieParser())
    await app.listen(0)
    applicationUrl = await app.getUrl()
  })

  afterAll(async () => {
    if (app !== undefined) await app.close()
    vi.unstubAllEnvs()
  })

  it('returns only the actor memberships and effective permissions', async () => {
    const actorA = await registerUser('actor-a@example.com')
    const actorB = await registerUser('actor-b@example.com')
    await createAuthenticationContextFixtures(databaseUrls.applicationUrl, actorA.id, actorB.id)

    const unauthenticated = await fetch(`${applicationUrl}/v1/auth/context`)
    expect(unauthenticated.status).toBe(401)

    const webLogin = await fetch(`${applicationUrl}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'actor-a@example.com', password: 'password123' }),
    })
    const webBody: unknown = await webLogin.json()
    expect(webBody).not.toHaveProperty('sessionToken')
    expect(JSON.stringify(webBody)).not.toContain('passwordHash')
    expect(webLogin.headers.get('set-cookie')).toContain('HttpOnly')
    expect(webLogin.headers.get('set-cookie')).toContain('Secure')
    expect(webLogin.headers.get('set-cookie')).toContain('SameSite=Lax')
    const sessionCookie = webLogin.headers.get('set-cookie')?.split(';')[0]
    if (sessionCookie === undefined) throw new Error('Web login did not issue a session cookie')
    const cookieContext = await fetch(`${applicationUrl}/v1/auth/context`, { headers: { cookie: sessionCookie } })
    expect(cookieContext.status).toBe(200)
    const webLogout = await fetch(`${applicationUrl}/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie: sessionCookie },
    })
    expect(webLogout.status).toBe(200)
    expect(webLogout.headers.get('set-cookie')).toContain('HttpOnly')
    expect(webLogout.headers.get('set-cookie')).toContain('Secure')
    expect(webLogout.headers.get('set-cookie')).toContain('SameSite=Lax')
    const revokedCookieContext = await fetch(`${applicationUrl}/v1/auth/context`, { headers: { cookie: sessionCookie } })
    expect(revokedCookieContext.status).toBe(401)

    const mobileLogin = await fetch(`${applicationUrl}/v1/auth/mobile/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'actor-a@example.com', password: 'password123' }),
    })
    const mobileSession = mobileSessionIssuedSchema.parse(await mobileLogin.json())
    const contextResponse = await fetch(`${applicationUrl}/v1/auth/context`, {
      headers: { authorization: `Bearer ${mobileSession.sessionToken}` },
    })
    const context = authenticationContextSchema.parse(await contextResponse.json())

    expect(contextResponse.status).toBe(200)
    expect(context.memberships).toHaveLength(2)
    expect(
      context.memberships.map(({ institution, role, permissions }) => ({
        institutionName: institution.name,
        roleName: role.name,
        roleEnvironment: role.environment,
        permissions,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          institutionName: 'North',
          roleName: 'Renamed student role',
          roleEnvironment: 'student',
          permissions: [{ key: 'student.read.own', scope: 'own' }],
        },
        {
          institutionName: 'South',
          roleName: 'Professional role',
          roleEnvironment: 'professional',
          permissions: [{ key: 'student.read.assigned', scope: 'assigned' }],
        },
      ]),
    )
    expect(JSON.stringify(context)).not.toContain('passwordHash')
    expect(JSON.stringify(context)).not.toContain('sessionToken')

    const actorBSession = await loginMobile('actor-b@example.com')
    const actorBContext = authenticationContextSchema.parse(
      await (
        await fetch(`${applicationUrl}/v1/auth/context`, {
          headers: { authorization: `Bearer ${actorBSession.sessionToken}` },
        })
      ).json(),
    )
    expect(actorBContext.memberships).toHaveLength(1)
    expect(actorBContext.memberships.map((membership) => membership.institution.name)).toEqual(['Elsewhere'])
  })

  async function registerUser(email: string) {
    const response = await fetch(`${applicationUrl}/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', name: email }),
    })
    return authenticatedUserSchema.parse(await response.json())
  }

  async function loginMobile(email: string) {
    const response = await fetch(`${applicationUrl}/v1/auth/mobile/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    })
    return mobileSessionIssuedSchema.parse(await response.json())
  }
})
