import { assertNever } from '@habituar/core/assert-never'
import { Outcome } from '@habituar/core/failure'
import { InstitutionId, InvitationId, institutionIdSchema } from '@habituar/core/identity/ids'
import { CreateInvitationInput, Invitation, InvitationAccepted, InvitationPreview, InvitationState, invitationSchema, invitationPreviewSchema, invitationAcceptedSchema } from '@habituar/core/invitations'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthenticationService, SessionIssued } from '../authentication/authentication.service.js'
import { hashPassword } from '../authentication/password.js'
import { hashSessionToken } from '../authentication/session-token.js'
import { Actor } from '../authorization/authentication.guard.js'
import { Database, DatabaseTransaction } from '../database/database.js'
import { findInstitution } from '../database/institution-queries.js'
import { invitationQueries } from '../database/invitation-queries.js'
import { invitations } from '../database/schema.js'
import { Environment } from '../environment/environment.schema.js'
import { Clock } from '../platform/clock.js'
import { EMAIL_SENDER } from '../platform/email-sender.js'
import type { EmailSender } from '../platform/email-sender.js'
import { CryptoIdGenerator } from '../platform/id-generator.js'

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000
type InvitationRow = typeof invitations.$inferSelect
type InvitationFailure = 'invitation-not-found' | 'invitation-expired' | 'invitation-revoked' | 'invitation-already-accepted'

function fail<T>(code: InvitationFailure | 'invalid-role-for-environment' | 'invitation-email-mismatch' | 'already-member' | 'platform-administrator-cannot-join' | 'conflict'): Outcome<T> {
  return { status: 'failure', failure: { code, message: code } }
}

function stateOf(row: InvitationRow, now: Date): InvitationState {
  if (row.acceptedAt !== null) return { status: 'accepted' }
  if (row.revokedAt !== null) return { status: 'revoked' }
  if (row.expiresAt.getTime() <= now.getTime()) return { status: 'expired' }
  return { status: 'pending' }
}

function failureForState(state: InvitationState): InvitationFailure | undefined {
  switch (state.status) {
    case 'pending': return undefined
    case 'accepted': return 'invitation-already-accepted'
    case 'revoked': return 'invitation-revoked'
    case 'expired': return 'invitation-expired'
    default: return assertNever(state)
  }
}

async function toInvitation(transaction: DatabaseTransaction, row: InvitationRow, now: Date): Promise<Invitation> {
  const assignedRoles = await invitationQueries.roleIds(transaction, row.id)
  return invitationSchema.parse({
    id: row.id, institutionId: row.institutionId, email: row.email, environment: row.environment,
    roleIds: assignedRoles.map(assigned => assigned.roleId), createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(), state: stateOf(row, now),
  })
}

/** Dona do ciclo de vida do convite, inclusive do vínculo criado pelo aceite de uso único. */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly database: Database,
    private readonly authentication: AuthenticationService,
    private readonly idGenerator: CryptoIdGenerator,
    private readonly clock: Clock,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async list(): Promise<Invitation[]> {
    return this.database.withTenant(async transaction => {
      const rows = await invitationQueries.list(transaction)
      const now = this.clock.now()
      return Promise.all(rows.map(row => toInvitation(transaction, row, now)))
    })
  }

  async create(input: CreateInvitationInput, actor: Actor): Promise<Outcome<{ invitation: Invitation; inviteUrl: string }>> {
    const token = this.idGenerator.generate()
    const now = this.clock.now()
    const inviteUrl = new URL(`/invite/${encodeURIComponent(token)}`, this.config.get('WEB_APP_URL', { infer: true })).toString()
    const outcome = await this.database.withTenant(async transaction => {
      const roleIds = [...new Set(input.roleIds)]
      const selectedRoles = await invitationQueries.validRoles(transaction, roleIds, input.institutionId, input.environment)
      if (selectedRoles.length !== roleIds.length) return fail<{ invitation: Invitation; inviteUrl: string }>('invalid-role-for-environment')

      await invitationQueries.revokeOpenForEmail(transaction, input.institutionId, input.email, now, actor.userId)
      const [row] = await invitationQueries.create(transaction, {
        institutionId: input.institutionId, email: input.email, environment: input.environment,
        tokenHash: hashSessionToken(token), expiresAt: this.clock.after(INVITATION_TTL_MS), invitedByUserId: actor.userId,
      })
      if (row === undefined) throw new Error('Invitation insert returned no row')
      await invitationQueries.grantRoles(transaction, roleIds.map(roleId => ({
        invitationId: row.id, roleId, institutionId: row.institutionId, environment: row.environment,
      })))
      return { status: 'success', value: { invitation: await toInvitation(transaction, row, now), inviteUrl } } as const
    })
    if (outcome.status === 'success') await this.emailSender.sendInvitation({ email: input.email, inviteUrl })
    return outcome
  }

  async revoke(institutionId: InstitutionId, invitationId: InvitationId, actor: Actor): Promise<Outcome<Invitation>> {
    return this.database.withTenant(async transaction => {
      const row = await invitationQueries.findById(transaction, institutionId, invitationId)
      if (row === undefined) return fail<Invitation>('invitation-not-found')
      const stateFailure = failureForState(stateOf(row, this.clock.now()))
      if (stateFailure !== undefined) return fail<Invitation>(stateFailure)
      const now = this.clock.now()
      const [revoked] = await invitationQueries.revoke(transaction, row.id, now, actor.userId)
      if (revoked === undefined) {
        const latest = await invitationQueries.findById(transaction, institutionId, invitationId)
        if (latest === undefined) return fail<Invitation>('invitation-not-found')
        const latestFailure = failureForState(stateOf(latest, this.clock.now()))
        if (latestFailure !== undefined) return fail<Invitation>(latestFailure)
        throw new Error('Pending invitation was not revoked')
      }
      return { status: 'success', value: await toInvitation(transaction, revoked, now) }
    })
  }

  async preview(token: string): Promise<Outcome<InvitationPreview>> {
    return this.database.withInvitationToken(hashSessionToken(token), async transaction => {
      const row = await invitationQueries.findByTokenHash(transaction, hashSessionToken(token))
      if (row === undefined) return fail<InvitationPreview>('invitation-not-found')
      const institution = await findInstitution(transaction, institutionIdSchema.parse(row.institutionId))
      if (institution === undefined) throw new Error('Invitation references missing institution')
      const account = await invitationQueries.findAccountByEmail(transaction, row.email)
      return { status: 'success', value: invitationPreviewSchema.parse({
        institution: { id: institution.id, name: institution.name }, email: row.email,
        environment: row.environment, hasAccount: account !== undefined, state: stateOf(row, this.clock.now()),
      }) }
    })
  }

  async accept(token: string, actor: Actor): Promise<Outcome<InvitationAccepted>> {
    return this.database.withInvitationAcceptance(hashSessionToken(token), async transaction => {
      const row = await this.pendingInvitation(transaction, token)
      if (row.status === 'failure') return row
      const account = await invitationQueries.findAccountById(transaction, actor.userId)
      if (account === undefined) return fail<InvitationAccepted>('invitation-not-found')
      if (account.isPlatformAdministrator) return fail<InvitationAccepted>('platform-administrator-cannot-join')
      if (account.email.toLowerCase() !== row.value.email) return fail<InvitationAccepted>('invitation-email-mismatch')
      return this.finishAcceptance(transaction, row.value, account.id)
    })
  }

  async acceptWithRegistration(token: string, name: string, password: string): Promise<Outcome<SessionIssued>> {
    return this.database.withInvitationAcceptance(hashSessionToken(token), async transaction => {
      const row = await this.pendingInvitation(transaction, token)
      if (row.status === 'failure') return row
      const existing = await invitationQueries.findAccountByEmail(transaction, row.value.email)
      if (existing !== undefined) return fail<SessionIssued>('conflict')
      const [account] = await invitationQueries.createUser(transaction, { email: row.value.email, name, passwordHash: await hashPassword(password) })
      if (account === undefined) throw new Error('User insert returned no row')
      const accepted = await this.finishAcceptance(transaction, row.value, account.id)
      if (accepted.status === 'failure') throw new Error('Invitation acceptance raced with registration')
      return { status: 'success', value: await this.authentication.issueSession(transaction, account) }
    })
  }

  private async pendingInvitation(transaction: DatabaseTransaction, token: string): Promise<Outcome<InvitationRow>> {
    const row = await invitationQueries.findByTokenHash(transaction, hashSessionToken(token))
    if (row === undefined) return fail<InvitationRow>('invitation-not-found')
    const stateFailure = failureForState(stateOf(row, this.clock.now()))
    return stateFailure === undefined ? { status: 'success', value: row } : fail<InvitationRow>(stateFailure)
  }

  private async finishAcceptance(transaction: DatabaseTransaction, row: InvitationRow, userId: string): Promise<Outcome<InvitationAccepted>> {
    const existing = await invitationQueries.findMembership(transaction, userId, row.institutionId)
    if (existing !== undefined) return fail<InvitationAccepted>('already-member')
    const [membership] = await invitationQueries.createMembership(transaction, { userId, institutionId: row.institutionId, environment: row.environment })
    if (membership === undefined) throw new Error('Membership insert returned no row')
    const granted = await invitationQueries.roleIds(transaction, row.id)
    await invitationQueries.grantMembershipRoles(transaction, granted.map(grant => ({ membershipId: membership.id, roleId: grant.roleId, institutionId: row.institutionId, environment: row.environment })))
    const [accepted] = await invitationQueries.accept(transaction, row.id, userId, this.clock.now())
    if (accepted === undefined) throw new Error('Invitation acceptance raced with another transaction')
    return { status: 'success', value: invitationAcceptedSchema.parse({ institutionId: row.institutionId }) }
  }
}
