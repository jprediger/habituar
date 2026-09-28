import { Outcome } from '@habituar/core/failure'
import { InstitutionId, institutionIdSchema } from '@habituar/core/identity/ids'
import { Institution, InstitutionInput, PlatformMember, PlatformRole, institutionSchema } from '@habituar/core/platform'
import { Injectable } from '@nestjs/common'
import { Actor } from '../authorization/authentication.guard.js'
import { Database } from '../database/database.js'
import { createInstitution, findInstitution, findInstitutionByDocument, listInstitutionMembers, listInstitutionRoles, listInstitutions, updateInstitutionRegistration } from '../database/institution-queries.js'
import { seedPermissionCatalog } from '../database/seeds/permission-catalog.seed.js'
import { seedRoleTemplates } from '../database/seeds/role-templates.js'
import { Clock } from '../platform/clock.js'
import { CryptoIdGenerator } from '../platform/id-generator.js'

type InstitutionRow = NonNullable<Awaited<ReturnType<typeof findInstitution>>>

/** Mantém o cadastro institucional e garante os papéis iniciais na criação. */
@Injectable()
export class InstitutionsService {
  constructor(private readonly database: Database, private readonly ids: CryptoIdGenerator, private readonly clock: Clock) {}

  async list(actor: Actor): Promise<Institution[]> {
    return this.database.withIdentity({ actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      const rows = await listInstitutions(transaction)
      return rows.map(toInstitution)
    })
  }

  async create(actor: Actor, input: InstitutionInput): Promise<Outcome<Institution>> {
    const institutionId = institutionIdSchema.parse(this.ids.generate())
    return this.database.withProvisionedInstitution({ actorId: actor.userId, sessionId: actor.sessionId }, institutionId, async transaction => {
      const existing = await findInstitutionByDocument(transaction, input.documentNumber)
      if (existing !== undefined) return { status: 'failure', failure: { code: 'document-already-registered', message: 'Document already registered.' } }
      const row = await createInstitution(transaction, institutionId, input)
      await seedPermissionCatalog(transaction)
      await seedRoleTemplates(transaction, institutionId)
      return { status: 'success', value: toInstitution(row) }
    })
  }

  async get(actor: Actor, institutionId: InstitutionId): Promise<Outcome<Institution>> {
    return this.database.withProvisionedInstitution({ actorId: actor.userId, sessionId: actor.sessionId }, institutionId, async transaction => {
      const row = await findInstitution(transaction, institutionId)
      return row === undefined
        ? { status: 'failure', failure: { code: 'not_found', message: 'Institution not found.' } }
        : { status: 'success', value: toInstitution(row) }
    })
  }

  async update(actor: Actor, institutionId: InstitutionId, input: InstitutionInput): Promise<Outcome<Institution>> {
    return this.database.withProvisionedInstitution({ actorId: actor.userId, sessionId: actor.sessionId }, institutionId, async transaction => {
      const duplicate = await findInstitutionByDocument(transaction, input.documentNumber)
      if (duplicate !== undefined && duplicate.id !== institutionId) return { status: 'failure', failure: { code: 'document-already-registered', message: 'Document already registered.' } }
      const row = await updateInstitutionRegistration(transaction, institutionId, input, this.clock.now())
      return row === undefined
        ? { status: 'failure', failure: { code: 'not_found', message: 'Institution not found.' } }
        : { status: 'success', value: toInstitution(row) }
    })
  }

  async listRoles(actor: Actor, institutionId: InstitutionId): Promise<PlatformRole[]> {
    return this.database.withProvisionedInstitution({ actorId: actor.userId, sessionId: actor.sessionId }, institutionId, transaction => listInstitutionRoles(transaction, institutionId))
  }

  async listMembers(actor: Actor, institutionId: InstitutionId): Promise<PlatformMember[]> {
    return this.database.withProvisionedInstitution({ actorId: actor.userId, sessionId: actor.sessionId }, institutionId, transaction => listInstitutionMembers(transaction, institutionId))
  }
}

function toInstitution(row: InstitutionRow): Institution {
  return institutionSchema.parse({
    id: row.id,
    name: row.name,
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  })
}
