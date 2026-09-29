import { assertNever } from '@habituar/core/assert-never'
import { StaffAuthorization } from '@habituar/core/delegation'
import { FailureCode, Outcome } from '@habituar/core/failure'
import { InstitutionId, InvitationId, RoleId, institutionIdSchema } from '@habituar/core/identity/ids'
import { canInviteStudentAccount, CreateStudentInvitationInput } from '@habituar/core/students'
import { CreateInvitationInput, Invitation, InvitationAccepted, InvitationPreview, InvitationState, invitationSchema, invitationPreviewSchema, invitationAcceptedSchema } from '@habituar/core/invitations'
import { ListStaffInvitationsInput, StaffInvitationPage, staffInvitationPageSchema } from '@habituar/core/staff'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthenticationService, SessionIssued } from '../authentication/authentication.service.js'
import { hashPassword } from '../authentication/password.js'
import { hashSessionToken } from '../authentication/session-token.js'
import { Actor } from '../authorization/authentication.guard.js'
import { lockInstitutionAuthorization } from '../database/authorization-lock.js'
import { Database, DatabaseTransaction } from '../database/database.js'
import { InstitutionsService } from '../institutions/institutions.service.js'
import { Environment } from '../environment/environment.schema.js'
import { Clock } from '../platform/clock.js'
import { EMAIL_SENDER } from '../platform/email-sender.js'
import type { EmailSender } from '../platform/email-sender.js'
import { CryptoIdGenerator } from '../platform/id-generator.js'
import { RbacService, StaffActor } from '../rbac/rbac.service.js'
import { InvitationRow, InvitationsRepository } from './invitations.repository.js'

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000
type InvitationFailure = 'invitation-not-found' | 'invitation-expired' | 'invitation-revoked' | 'invitation-already-accepted'
type InvitationCreated = { invitation: Invitation; inviteUrl: string }

function fail<T>(code: FailureCode): Outcome<T> {
  return { status: 'failure', failure: { code, message: code } }
}

function failForDenial<T>(authorization: StaffAuthorization): Outcome<T> | undefined {
  switch (authorization.status) {
    case 'allowed': return undefined
    case 'denied': return fail<T>(authorization.reason)
    default: return assertNever(authorization)
  }
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

/** Dona do ciclo de vida do convite, inclusive do vínculo criado pelo aceite de uso único. */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly database: Database,
    private readonly invitations: InvitationsRepository,
    private readonly institutions: InstitutionsService,
    private readonly authentication: AuthenticationService,
    private readonly rbac: RbacService,
    private readonly idGenerator: CryptoIdGenerator,
    private readonly clock: Clock,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async list(): Promise<Invitation[]> {
    return this.database.withTenant(async transaction => {
      const rows = await this.invitations.list(transaction)
      const now = this.clock.now()
      return Promise.all(rows.map(row => this.toInvitation(transaction, row, now)))
    })
  }

  /** Página por estado para a gestão institucional; a leitura já foi autorizada na borda. */
  async listPage(input: ListStaffInvitationsInput): Promise<StaffInvitationPage> {
    return this.database.withTenant(async transaction => {
      const now = this.clock.now()
      const rows = await this.invitations.listPage(transaction, input.status, now, input.pageSize, (input.page - 1) * input.pageSize)
      const total = await this.invitations.countPage(transaction, input.status, now)
      const items = await Promise.all(rows.map(row => this.toInvitation(transaction, row, now)))
      return staffInvitationPageSchema.parse({ items, total, page: input.page, pageSize: input.pageSize })
    })
  }

  async create(input: CreateInvitationInput, actor: StaffActor): Promise<Outcome<InvitationCreated>> {
    const token = this.idGenerator.generate()
    const inviteUrl = this.inviteUrlFor(token)
    const outcome = await this.database.withTenant<Outcome<InvitationCreated>>(async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      // Contas de aluno e responsável só entram pelo convite com alvo da fatia de alunos.
      if (input.environment === 'student') return fail<InvitationCreated>('invalid-role-for-environment')
      return this.issue(transaction, actor, { institutionId: input.institutionId, email: input.email, environment: input.environment, roleIds: [...new Set(input.roleIds)] }, token, inviteUrl)
    })
    if (outcome.status === 'success') await this.emailSender.sendInvitation({ email: input.email, inviteUrl })
    return outcome
  }

  /** Convida aluno ou responsável sem exigir permissão de gestão da equipe. */
  async createStudentInvitation(input: CreateStudentInvitationInput, actor: StaffActor): Promise<Outcome<InvitationCreated>> {
    const token = this.idGenerator.generate()
    const inviteUrl = this.inviteUrlFor(token)
    const email = input.email.trim().toLowerCase()
    const outcome = await this.database.withTenant<Outcome<InvitationCreated>>(async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.rbac.hasPermissionInTransaction(transaction, actor, input.institutionId, 'guardian.link', input.studentId)) return fail<InvitationCreated>('student-not-found')
      const student = await this.invitations.findStudentTarget(transaction, input.institutionId, input.studentId)
      if (student === undefined || student.archivedAt !== null) return fail<InvitationCreated>('student-not-found')
      if (input.target === 'student' && (student.userId !== null || !canInviteStudentAccount(student.birthDate, this.clock.now().toISOString().slice(0, 10)))) return fail<InvitationCreated>(student.userId === null ? 'student-below-account-age' : 'student-account-exists')
      let guardianId: string | null = null
      if (input.target === 'guardian') {
        if (input.guardianId === null) return fail<InvitationCreated>('guardian-not-found')
        const guardian = await this.invitations.findGuardianTarget(transaction, input.institutionId, input.guardianId)
        if (guardian === undefined || guardian.userId !== null || guardian.email === null || guardian.email.toLowerCase() !== email) return fail<InvitationCreated>('guardian-not-found')
        if (await this.invitations.findStudentGuardianLink(transaction, input.studentId, input.guardianId) === undefined) return fail<InvitationCreated>('guardian-not-found')
        guardianId = input.guardianId
      }
      const template = await this.invitations.findTemplateRole(transaction, input.institutionId, input.target)
      if (template === undefined) throw new Error('Student invitation role is missing')
      if ((await this.invitations.findActiveMembershipByEmail(transaction, email)).length > 0) return fail<InvitationCreated>('already-member')
      const now = this.clock.now()
      await this.invitations.revokeOpenForEmail(transaction, input.institutionId, email, now, actor.userId)
      const [invitation] = await this.invitations.create(transaction, {
        institutionId: input.institutionId, email, environment: 'student', tokenHash: hashSessionToken(token), expiresAt: this.clock.after(INVITATION_TTL_MS),
        invitedByUserId: actor.userId, issuerKind: actor.kind, studentId: input.studentId, guardianId, targetKind: input.target,
      })
      if (invitation === undefined) throw new Error('Invitation insert returned no row')
      await this.invitations.grantRoles(transaction, [{ invitationId: invitation.id, roleId: template.id, institutionId: input.institutionId, environment: 'student' }])
      return { status: 'success' as const, value: { invitation: await this.toInvitation(transaction, invitation, now), inviteUrl } }
    })
    if (outcome.status === 'success') await this.emailSender.sendInvitation({ email, inviteUrl })
    return outcome
  }

  /**
   * Reenvio é emissão nova com a autoridade de quem reenvia, recalculada agora; a de quem
   * criou o convite original não é reaproveitada.
   */
  async resend(institutionId: InstitutionId, invitationId: InvitationId, actor: StaffActor): Promise<Outcome<InvitationCreated>> {
    const token = this.idGenerator.generate()
    const inviteUrl = this.inviteUrlFor(token)
    const outcome = await this.database.withTenant(async transaction => {
      await lockInstitutionAuthorization(transaction, institutionId)
      const row = await this.invitations.findById(transaction, institutionId, invitationId)
      if (row === undefined) return fail<InvitationCreated>('invitation-not-found')
      if (row.studentId !== null) return fail<InvitationCreated>('invalid-role-for-environment')
      // Expirado pode ser reenviado; aceito e revogado são desfechos definitivos.
      const stateFailure = failureForState(stateOf(row, this.clock.now()))
      if (stateFailure === 'invitation-already-accepted' || stateFailure === 'invitation-revoked') return fail<InvitationCreated>(stateFailure)
      const roleIds = (await this.invitations.listRoleIds(transaction, row.id)).map(role => role.roleId)
      return this.issue(transaction, actor, { institutionId, email: row.email, environment: row.environment, roleIds }, token, inviteUrl)
    })
    if (outcome.status === 'success') await this.emailSender.sendInvitation({ email: outcome.value.invitation.email, inviteUrl })
    return outcome
  }

  async revoke(institutionId: InstitutionId, invitationId: InvitationId, actor: StaffActor): Promise<Outcome<Invitation>> {
    return this.database.withTenant(async transaction => {
      await lockInstitutionAuthorization(transaction, institutionId)
      const row = await this.invitations.findById(transaction, institutionId, invitationId)
      if (row === undefined) return fail<Invitation>('invitation-not-found')
      if (row.studentId !== null) return fail<Invitation>('invalid-role-for-environment')
      const stateFailure = failureForState(stateOf(row, this.clock.now()))
      if (stateFailure !== undefined) return fail<Invitation>(stateFailure)
      const roleIds = (await this.invitations.listRoleIds(transaction, row.id)).map(role => role.roleId)
      const denial = failForDenial<Invitation>(await this.rbac.authorizeStaffAction(transaction, actor, institutionId, 'revoke-invitation', await this.rbac.listRoleGrants(transaction, roleIds)))
      if (denial !== undefined) return denial
      const now = this.clock.now()
      const [revoked] = await this.invitations.revoke(transaction, row.id, now, actor.userId)
      if (revoked === undefined) throw new Error('Pending invitation was not revoked under the institution lock')
      return { status: 'success', value: await this.toInvitation(transaction, revoked, now) }
    })
  }

  /**
   * Chamado pela edição de papel, na transação dela: convite aberto não pode entregar
   * concessões diferentes das que o emissor viu ao convidar.
   */
  async revokeOpenReferencingRole(transaction: DatabaseTransaction, roleId: RoleId, actor: Actor): Promise<number> {
    const revoked = await this.invitations.revokeOpenReferencingRole(transaction, roleId, this.clock.now(), actor.userId)
    return revoked.length
  }

  /** Convites ainda aceitáveis por papel, para impacto de edição e para a regra de exclusão. */
  async countPendingByRole(transaction: DatabaseTransaction): Promise<ReadonlyMap<string, number>> {
    const rows = await this.invitations.countPendingByRole(transaction, this.clock.now())
    return new Map(rows.map(row => [row.roleId, row.total]))
  }

  async preview(token: string): Promise<Outcome<InvitationPreview>> {
    return this.database.withInvitationToken(hashSessionToken(token), async transaction => {
      const row = await this.invitations.findByTokenHash(transaction, hashSessionToken(token))
      if (row === undefined) return fail<InvitationPreview>('invitation-not-found')
      const institution = await this.institutions.findSummary(transaction, institutionIdSchema.parse(row.institutionId))
      if (institution === undefined) throw new Error('Invitation references missing institution')
      const account = await this.invitations.findAccountByEmail(transaction, row.email)
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
      const account = await this.invitations.findAccountById(transaction, actor.userId)
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
      const existing = await this.invitations.findAccountByEmail(transaction, row.value.email)
      if (existing !== undefined) return fail<SessionIssued>('conflict')
      // Autoridade revalidada antes de criar a conta: aceite recusado não deixa conta órfã.
      const authority = await this.revalidateIssuer(transaction, row.value)
      if (authority.status === 'failure') return authority
      const [account] = await this.invitations.createUser(transaction, { email: row.value.email, name, passwordHash: await hashPassword(password) })
      if (account === undefined) throw new Error('User insert returned no row')
      const accepted = await this.finishAcceptance(transaction, row.value, account.id)
      if (accepted.status === 'failure') throw new Error('Invitation acceptance raced with registration')
      return { status: 'success', value: await this.authentication.issueSession(transaction, account) }
    })
  }

  private inviteUrlFor(token: string): string {
    return new URL(`/invite/${encodeURIComponent(token)}`, this.config.get('WEB_APP_URL', { infer: true })).toString()
  }

  private async issue(
    transaction: DatabaseTransaction,
    actor: StaffActor,
    request: Readonly<{ institutionId: InstitutionId; email: string; environment: InvitationRow['environment']; roleIds: readonly string[] }>,
    token: string,
    inviteUrl: string,
  ): Promise<Outcome<InvitationCreated>> {
    if (request.roleIds.length === 0) return fail<InvitationCreated>('invalid-role-for-environment')
    const selectedRoles = await this.invitations.listValidRoles(transaction, request.roleIds, request.institutionId, request.environment)
    if (selectedRoles.length !== request.roleIds.length) return fail<InvitationCreated>('invalid-role-for-environment')
    const denial = failForDenial<InvitationCreated>(await this.rbac.authorizeStaffAction(transaction, actor, request.institutionId, 'invite', await this.rbac.listRoleGrants(transaction, request.roleIds)))
    if (denial !== undefined) return denial
    const activeMembers = await this.invitations.findActiveMembershipByEmail(transaction, request.email)
    if (activeMembers.length > 0) return fail<InvitationCreated>('already-member')

    const now = this.clock.now()
    await this.invitations.revokeOpenForEmail(transaction, request.institutionId, request.email, now, actor.userId)
    const [row] = await this.invitations.create(transaction, {
      institutionId: request.institutionId, email: request.email, environment: request.environment,
      tokenHash: hashSessionToken(token), expiresAt: this.clock.after(INVITATION_TTL_MS), invitedByUserId: actor.userId, issuerKind: actor.kind,
    })
    if (row === undefined) throw new Error('Invitation insert returned no row')
    await this.invitations.grantRoles(transaction, request.roleIds.map(roleId => ({
      invitationId: row.id, roleId, institutionId: row.institutionId, environment: row.environment,
    })))
    return { status: 'success', value: { invitation: await this.toInvitation(transaction, row, now), inviteUrl } }
  }

  private async toInvitation(transaction: DatabaseTransaction, row: InvitationRow, now: Date): Promise<Invitation> {
    const assignedRoles = await this.invitations.listRoleIds(transaction, row.id)
    return invitationSchema.parse({
      id: row.id, institutionId: row.institutionId, email: row.email, environment: row.environment,
      roleIds: assignedRoles.map(assigned => assigned.roleId), createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(), state: stateOf(row, now),
    })
  }

  private async pendingInvitation(transaction: DatabaseTransaction, token: string): Promise<Outcome<InvitationRow>> {
    const row = await this.invitations.findByTokenHash(transaction, hashSessionToken(token))
    if (row === undefined) return fail<InvitationRow>('invitation-not-found')
    const stateFailure = failureForState(stateOf(row, this.clock.now()))
    return stateFailure === undefined ? { status: 'success', value: row } : fail<InvitationRow>(stateFailure)
  }

  /**
   * O aceite vale só se o emissor ainda poderia emitir este convite agora, com os papéis
   * como estão agora. Emissor removido ou rebaixado exige um convite novo de quem pode.
   */
  private async revalidateIssuer(transaction: DatabaseTransaction, row: InvitationRow): Promise<Outcome<readonly string[]>> {
    const roleIds = (await this.invitations.listRoleIds(transaction, row.id)).map(role => role.roleId)
    if (roleIds.length === 0) return fail('invitation-authority-lost')
    if (row.studentId !== null) {
      const institutionId = institutionIdSchema.parse(row.institutionId)
      const student = await this.invitations.findStudentTarget(transaction, institutionId, row.studentId)
      if (student === undefined || student.archivedAt !== null || (row.targetKind === 'student' && student.userId !== null)) return fail('invitation-authority-lost')
      if (row.targetKind === 'student' && !canInviteStudentAccount(student.birthDate, this.clock.now().toISOString().slice(0, 10))) return fail('invitation-authority-lost')
      const authorized = await this.rbac.hasPermissionInTransaction(transaction, { userId: row.invitedByUserId }, row.institutionId, 'guardian.link', row.studentId)
      if (!authorized) return fail('invitation-authority-lost')
      const template = await this.invitations.findTemplateRole(transaction, institutionId, row.targetKind ?? '')
      if (template === undefined || roleIds.length !== 1 || roleIds[0] !== template.id) return fail('invitation-authority-lost')
      if (row.guardianId !== null) {
        const guardian = await this.invitations.findGuardianTarget(transaction, institutionId, row.guardianId)
        if (guardian === undefined || guardian.userId !== null || await this.invitations.findStudentGuardianLink(transaction, row.studentId, row.guardianId) === undefined) return fail('invitation-authority-lost')
      }
      return { status: 'success', value: roleIds }
    }
    const grants = await this.rbac.listRoleGrants(transaction, roleIds)
    const isAuthorized = await this.rbac.isInvitationIssuerAuthorized(transaction, { kind: row.issuerKind, userId: row.invitedByUserId }, row.institutionId, grants)
    return isAuthorized ? { status: 'success', value: roleIds } : fail('invitation-authority-lost')
  }

  private async finishAcceptance(transaction: DatabaseTransaction, row: InvitationRow, userId: string): Promise<Outcome<InvitationAccepted>> {
    const authority = await this.revalidateIssuer(transaction, row)
    if (authority.status === 'failure') return authority
    const existing = await this.invitations.findMembership(transaction, userId, row.institutionId)
    if (existing !== undefined && existing.removedAt === null) return fail<InvitationAccepted>('already-member')
    if (row.studentId !== null) {
      let linked: readonly unknown[]
      if (row.targetKind === 'student') linked = await this.invitations.linkStudentAccount(transaction, institutionIdSchema.parse(row.institutionId), row.studentId, userId)
      else {
        if (row.targetKind !== 'guardian' || row.guardianId === null) return fail<InvitationAccepted>('invitation-authority-lost')
        linked = await this.invitations.linkGuardianAccount(transaction, institutionIdSchema.parse(row.institutionId), row.guardianId, userId)
      }
      if (linked.length === 0) return fail<InvitationAccepted>('invitation-authority-lost')
    }
    const membership = existing === undefined
      ? (await this.invitations.createMembership(transaction, { userId, institutionId: row.institutionId, environment: row.environment }))[0]
      : await this.invitations.reactivateMembership(transaction, existing.id, row.environment)
    if (membership === undefined) throw new Error('Membership write returned no row')
    await this.invitations.grantMembershipRoles(transaction, authority.value.map(roleId => ({ membershipId: membership.id, roleId, institutionId: row.institutionId, environment: row.environment })))
    const [accepted] = await this.invitations.accept(transaction, row.id, userId, this.clock.now())
    if (accepted === undefined) throw new Error('Invitation acceptance raced with another transaction')
    return { status: 'success', value: invitationAcceptedSchema.parse({ institutionId: row.institutionId }) }
  }
}
