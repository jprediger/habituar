import 'reflect-metadata'
import { mobileSessionIssuedSchema } from '@habituar/core/auth/schema'
import { RoleTemplateKey, roleTemplateKeySchema } from '@habituar/core/roles'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import { and, eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { vi } from 'vitest'
import { Database } from './database.js'
import { membershipRoles, memberships, roles } from './schema.js'
import { seedPermissionCatalog } from './seeds/permission-catalog.seed.js'
import { seedRoleTemplates } from './seeds/role-templates.js'
import { environmentSchema } from '../environment/environment.schema.js'
import { RequestContext } from '../platform/request-context.js'

const FIXTURE_SESSION_ID = 'f0000000-0000-4000-8000-000000000000'
const PASSWORD = 'password123'

export type ApiResponse = Readonly<{ status: number; body: unknown }>
export type Account = Readonly<{ userId: string; token: string }>
export type ProvisionedInstitution = Readonly<{ id: string; templates: Readonly<Record<RoleTemplateKey, string>> }>

/**
 * App real sobre o Postgres do Testcontainers, com dados montados pela conexão da
 * aplicação: guard, interceptor, RLS e lock são os de produção em cada chamada.
 */
export class StaffHarness {
  private constructor(
    private readonly app: INestApplication,
    readonly baseUrl: string,
    readonly database: Database,
    readonly ownerPool: Pool,
  ) {}

  static async start(applicationUrl: string, migrationUrl: string): Promise<StaffHarness> {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_VERSION', '0.0.0-test')
    vi.stubEnv('DATABASE_URL', applicationUrl)
    vi.stubEnv('WEB_APP_URL', 'http://localhost:3000')
    vi.stubEnv('EMAIL_TRANSPORT', 'disabled')
    const { AppModule } = await import('../app.module.js')
    const app = await NestFactory.create(AppModule, { logger: false })
    app.use(cookieParser())
    await app.listen(0)
    const environment = environmentSchema.parse({ NODE_ENV: 'test', APP_VERSION: '0.0.0-test', DATABASE_URL: applicationUrl })
    const database = new Database(new ConfigService(environment), new RequestContext())
    return new StaffHarness(app, await app.getUrl(), database, new Pool({ connectionString: migrationUrl }))
  }

  async stop(): Promise<void> {
    await this.app.close()
    await this.database.onApplicationShutdown()
    await this.ownerPool.end()
    vi.unstubAllEnvs()
  }

  async createAccount(email: string, options: Readonly<{ isPlatformAdministrator: boolean }> = { isPlatformAdministrator: false }): Promise<Account> {
    const registration = await fetch(`${this.baseUrl}/v1/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, name: email, password: PASSWORD }),
    })
    if (registration.status !== 200) throw new Error(`Fixture registration failed with ${String(registration.status)}`)
    if (options.isPlatformAdministrator) await this.ownerPool.query('update users set is_platform_administrator = true where email = $1', [email])
    const login = await fetch(`${this.baseUrl}/v1/auth/mobile/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }),
    })
    const { sessionToken, user } = mobileSessionIssuedSchema.parse(await login.json())
    return { userId: user.id, token: sessionToken }
  }

  /** Instituição com os templates reais do seed, como o provisionamento da 1B cria. */
  async provisionInstitution(name: string): Promise<ProvisionedInstitution> {
    const [created] = (await this.ownerPool.query<{ id: string }>('insert into institutions (name) values ($1) returning id', [name])).rows
    if (created === undefined) throw new Error('Fixture institution was not created')
    const templates = await this.database.withTenantOutsideRequest({ institutionId: created.id, actorId: FIXTURE_SESSION_ID, sessionId: FIXTURE_SESSION_ID }, async transaction => {
      await seedPermissionCatalog(transaction)
      await seedRoleTemplates(transaction, created.id)
      const rows = await transaction.select({ id: roles.id, templateKey: roles.templateKey }).from(roles).where(and(eq(roles.institutionId, created.id), eq(roles.isSystem, true)))
      return Object.fromEntries(rows.map(row => [roleTemplateKeySchema.parse(row.templateKey), row.id]))
    })
    return { id: created.id, templates: roleTemplateKeySchema.options.reduce<Record<RoleTemplateKey, string>>((all, key) => {
      const id = templates[key]
      if (id === undefined) throw new Error(`Fixture template ${key} is missing`)
      return { ...all, [key]: id }
    }, { 'team-management': '', 'care-assigned': '', 'care-institution': '', monitoring: '', student: '', guardian: '' }) }
  }

  async addMember(institutionId: string, userId: string, environment: 'professional' | 'monitor' | 'student', roleIds: readonly string[]): Promise<string> {
    return this.database.withTenantOutsideRequest({ institutionId, actorId: userId, sessionId: FIXTURE_SESSION_ID }, async transaction => {
      const [membership] = await transaction.insert(memberships).values({ userId, institutionId, environment }).returning()
      if (membership === undefined) throw new Error('Fixture membership was not created')
      if (roleIds.length > 0) await transaction.insert(membershipRoles).values(roleIds.map(roleId => ({ membershipId: membership.id, roleId, institutionId, environment })))
      return membership.id
    })
  }

  /** Consulta crua pelo dono em tabela global (`users`), sem RLS. */
  async ownerQuery<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<T[]> {
    return (await this.ownerPool.query<T>(text, [...values])).rows
  }

  /**
   * Consulta crua pelo dono dentro de um tenant. O dono também obedece `FORCE` RLS: sem
   * instalar a instituição, a leitura volta vazia e a asserção passaria sem provar nada.
   */
  async tenantQuery<T extends Record<string, unknown>>(institutionId: string, text: string, values: readonly unknown[] = []): Promise<T[]> {
    const client = await this.ownerPool.connect()
    try {
      await client.query('begin')
      await client.query("select set_config('app.institution_id', $1, true)", [institutionId])
      const result = await client.query<T>(text, [...values])
      await client.query('commit')
      return result.rows
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }

  async call(account: Account, method: string, path: string, body?: unknown): Promise<ApiResponse> {
    const response = await fetch(`${this.baseUrl}/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${account.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const text = await response.text()
    return { status: response.status, body: text.length === 0 ? undefined : JSON.parse(text) }
  }
}

/** Token de uso único a partir da URL devolvida na criação do convite. */
export function tokenFromInviteUrl(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('inviteUrl' in body) || typeof body.inviteUrl !== 'string') throw new Error('Response has no invite URL')
  return decodeURIComponent(new URL(body.inviteUrl).pathname.split('/').at(-1) ?? '')
}
