import { FailureCode, Outcome } from '@habituar/core/failure'
import { guardianIdSchema } from '@habituar/core/identity/ids'
import { calculateAgeInYears, CONSENT_TERMS, consentDocumentSchema, deriveAgeRange, AddStudentGuardianInput, Consent, ConsentPath, CreateStudentInput, ListStudentsInput, OwnConsent, OwnConsentPath, ownConsentSchema, PendingConsent, pendingConsentSchema, RecordConsentInput, RemoveStudentGuardianInput, ReplaceAssignmentsInput, StudentDetail, studentDetailSchema, StudentPage, studentPageSchema, StudentSummary, studentSummarySchema, UpdateStudentInput, consentSchema } from '@habituar/core/students'
import { Injectable } from '@nestjs/common'
import { Database } from '../database/database.js'
import { lockInstitutionAuthorization } from '../database/authorization-lock.js'
import { Clock } from '../platform/clock.js'
import { RbacService } from '../rbac/rbac.service.js'
import { StudentsRepository } from './students.repository.js'
import type { StudentRecord } from './students.repository.js'
import { isValidConsentDocument } from './consent-document.js'

function fail<T>(code: FailureCode): Outcome<T> { return { status: 'failure', failure: { code, message: code } } }

/** Leitura de alunos com alcance filtrado na consulta e dados familiares protegidos. */
@Injectable()
export class StudentsService {
  constructor(private readonly database: Database, private readonly repository: StudentsRepository, private readonly rbac: RbacService, private readonly clock: Clock) {}

  /** Lista alunos no próprio escopo, nunca carrega o tenant inteiro para filtrar em memória. */
  async list(actor: { readonly userId: string; readonly sessionId: string }, input: ListStudentsInput): Promise<StudentPage> {
    const scopes = await this.rbac.listPermissionScopes(actor, input.institutionId, 'student.read')
    const canReadAll = scopes.includes('institution')
    const canReadAssigned = scopes.includes('assigned')
    const canReadOwn = scopes.includes('own')
    return this.database.withTenantOutsideRequest({ institutionId: input.institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      let rows: readonly { student: StudentRecord }[] = []
      let total = 0
      if (canReadAll) {
        rows = await this.repository.listInstitutionStudents(transaction, input.institutionId, input.search, input.archived, input.pageSize, (input.page - 1) * input.pageSize)
        total = (await this.repository.countInstitutionStudents(transaction, input.institutionId, input.search, input.archived))[0]?.total ?? 0
      }
      else if (canReadAssigned && canReadOwn) {
        const membership = await this.repository.findActiveMembership(transaction, input.institutionId, actor.userId)
        rows = await this.repository.listOwnOrAssignedStudents(transaction, input.institutionId, actor.userId, membership?.id, input.search, input.archived, input.pageSize, (input.page - 1) * input.pageSize)
        total = (await this.repository.countOwnOrAssignedStudents(transaction, input.institutionId, actor.userId, membership?.id, input.search, input.archived))[0]?.total ?? 0
      }
      else if (canReadAssigned) {
        const membership = await this.repository.findActiveMembership(transaction, input.institutionId, actor.userId)
        if (membership !== undefined) {
          rows = await this.repository.listAssignedStudents(transaction, input.institutionId, membership.id, input.search, input.archived, input.pageSize, (input.page - 1) * input.pageSize)
          total = (await this.repository.countAssignedStudents(transaction, input.institutionId, membership.id, input.search, input.archived))[0]?.total ?? 0
        }
      } else if (canReadOwn) {
        rows = await this.repository.listOwnStudents(transaction, input.institutionId, actor.userId, input.search, input.archived, input.pageSize, (input.page - 1) * input.pageSize)
        total = (await this.repository.countOwnStudents(transaction, input.institutionId, actor.userId, input.search, input.archived))[0]?.total ?? 0
      }
      const items: StudentSummary[] = rows.map(({ student }) => studentSummarySchema.parse({
        id: student.id, fullName: student.fullName, socialName: student.socialName, birthDate: student.birthDate,
        ageRange: this.ageRange(student.birthDate), archivedAt: student.archivedAt?.toISOString() ?? null,
      }))
      return studentPageSchema.parse({ items, total, page: input.page, pageSize: input.pageSize })
    })
  }

  /** Detalha apenas quando o alcance atual permite o aluno e revela contato só a quem gerencia responsáveis. */
  async get(actor: { readonly userId: string; readonly sessionId: string }, institutionId: string, studentId: string): Promise<Outcome<StudentDetail>> {
    const scopes = await this.rbac.listPermissionScopes(actor, institutionId, 'student.read')
    return this.database.withTenantOutsideRequest({ institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      const student = await this.repository.findStudent(transaction, institutionId, studentId)
      if (student === undefined || (student.archivedAt !== null && !scopes.includes('institution'))) return fail<StudentDetail>('student-not-found')
      if (!scopes.includes('institution')) {
        const own = scopes.includes('own') ? await this.repository.findOwnStudent(transaction, institutionId, studentId, actor.userId) : undefined
        const membership = scopes.includes('assigned') ? await this.repository.findActiveMembership(transaction, institutionId, actor.userId) : undefined
        const assignment = membership === undefined ? undefined : await this.repository.findAssignment(transaction, membership.id, studentId)
        if (own === undefined && assignment === undefined) return fail<StudentDetail>('student-not-found')
      }
      const canReadContacts = await this.rbac.hasPermission(actor, institutionId, 'guardian.link', { studentId })
      const guardianRows = await this.repository.listGuardians(transaction, studentId)
      const consents = await this.repository.listStudentConsents(transaction, studentId)
      const institutionConsents = consents.filter(entry => entry.kind === 'institution-record')
      const consent = institutionConsents.find(entry => entry.revokedAt === null)
      const latestGuardianConfirmation = consents.find(entry => entry.kind === 'guardian-confirmation' && entry.termVersion === consent?.termVersion)
      const isConsentRevoked = (consent === undefined && institutionConsents.length > 0) || (latestGuardianConfirmation !== undefined && latestGuardianConfirmation.revokedAt !== null)
      const ageRange = this.ageRange(student.birthDate)
      const assignees = await this.repository.listStudentAssignments(transaction, studentId)
      const pendingInvitation = student.userId === null ? await this.repository.findPendingStudentInvitation(transaction, studentId, this.clock.now()) : undefined
      const value = studentDetailSchema.parse({
        id: student.id, fullName: student.fullName, socialName: student.socialName, birthDate: student.birthDate, ageRange, archivedAt: student.archivedAt?.toISOString() ?? null, version: student.version,
        guardians: guardianRows.map(guardian => ({ ...guardian, email: canReadContacts ? guardian.email : null, phone: canReadContacts ? guardian.phone : null })),
        assignments: assignees,
        consentStatus: ageRange === '18+' ? 'not-required' : isConsentRevoked ? 'revoked' : latestGuardianConfirmation !== undefined ? 'confirmed' : consent === undefined ? 'pending-guardian' : 'institution-recorded',
        institutionalDocumentName: canReadContacts ? consent?.documentName ?? null : null,
        institutionalDocumentId: canReadContacts && consent?.documentName ? consent.id : null,
        accountStatus: student.userId !== null ? 'active' : pendingInvitation === undefined ? 'none' : 'invitation-pending',
      })
      return { status: 'success', value }
    })
  }

  /** Cadastra dados civis e o termo institucional de menor na mesma transação. */
  async create(actor: { readonly userId: string; readonly sessionId: string }, input: CreateStudentInput): Promise<Outcome<StudentDetail>> {
    if (!await this.rbac.hasPermission(actor, input.institutionId, 'student.create')) return fail<StudentDetail>('forbidden')
    const today = this.clock.now().toISOString().slice(0, 10)
    const isMinor = calculateAgeInYears(input.birthDate, today) < 18
    if (input.birthDate > today || calculateAgeInYears(input.birthDate, today) > 120) return fail<StudentDetail>('invalid_input')
    if (input.institutionalConsent !== undefined && !isValidConsentDocument(input.institutionalConsent.document)) return fail<StudentDetail>('invalid_input')
    if (isMinor && input.institutionalConsent === undefined) return fail<StudentDetail>('consent-required')
    if (input.institutionalConsent?.termVersion !== undefined && input.institutionalConsent.termVersion !== CONSENT_TERMS.institutionRecord) return fail<StudentDetail>('configuration-conflict')
    if ((input.guardian !== undefined || input.institutionalConsent !== undefined) && !await this.rbac.hasPermission(actor, input.institutionId, 'guardian.link')) return fail<StudentDetail>('forbidden')
    const result = await this.database.withTenantOutsideRequest({ institutionId: input.institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.rbac.hasPermissionInTransaction(transaction, actor, input.institutionId, 'student.create')) return fail<string>('forbidden')
      if ((input.guardian !== undefined || input.institutionalConsent !== undefined) && !await this.rbac.hasPermissionInTransaction(transaction, actor, input.institutionId, 'guardian.link')) return fail<string>('forbidden')
      const [student] = await this.repository.insertStudent(transaction, { institutionId: input.institutionId, fullName: input.fullName, socialName: input.socialName, birthDate: input.birthDate, createdByUserId: actor.userId })
      if (student === undefined) throw new Error('Student insert returned no row')
      let guardianId: string | null = null
      if (input.guardian !== undefined) {
        const existing = input.guardian.email === null ? undefined : await this.repository.findGuardianByEmail(transaction, input.institutionId, input.guardian.email)
        let guardian = existing
        if (guardian === undefined) [guardian] = await this.repository.insertGuardian(transaction, { institutionId: input.institutionId, fullName: input.guardian.fullName, email: input.guardian.email, phone: input.guardian.phone, createdByUserId: actor.userId })
        if (guardian === undefined) throw new Error('Guardian insert returned no row')
        await this.repository.insertStudentGuardian(transaction, input.institutionId, student.id, guardian.id, input.guardian.relationship)
        guardianId = guardian.id
      }
      if (input.institutionalConsent !== undefined) {
        const guardianSnapshot = guardianId === null ? undefined : await this.repository.findGuardianSnapshot(transaction, student.id, guardianId)
        if (guardianId !== null && guardianSnapshot === undefined) throw new Error('Consent guardian is not linked to the student')
        const [consent] = await this.repository.insertConsent(transaction, { institutionId: input.institutionId, studentId: student.id, kind: 'institution-record', termVersion: CONSENT_TERMS.institutionRecord, guardianId, guardianNameSnapshot: guardianSnapshot?.fullName ?? null, guardianRelationshipSnapshot: guardianSnapshot?.relationship ?? null, signedOn: input.institutionalConsent.signedOn, documentName: input.institutionalConsent.document.fileName, documentMediaType: input.institutionalConsent.document.mediaType, documentBase64: input.institutionalConsent.document.base64, recordedByUserId: actor.userId })
        if (consent === undefined) throw new Error('Consent insert returned no row')
      }
      return { status: 'success' as const, value: student.id }
    })
    if (result.status === 'failure') return fail<StudentDetail>(result.failure.code)
    return this.get(actor, input.institutionId, result.value)
  }

  /** Atualiza dados cadastrais somente sobre a versão que o profissional leu. */
  async update(actor: { readonly userId: string; readonly sessionId: string }, input: UpdateStudentInput): Promise<Outcome<StudentDetail>> {
    const today = this.clock.now().toISOString().slice(0, 10)
    if (input.birthDate > today || calculateAgeInYears(input.birthDate, today) > 120) return fail<StudentDetail>('invalid_input')
    const result = await this.database.withTenantOutsideRequest({ institutionId: input.institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.rbac.hasPermissionInTransaction(transaction, actor, input.institutionId, 'student.update', input.studentId)) return fail<string>('student-not-found')
      const current = await this.repository.findStudent(transaction, input.institutionId, input.studentId)
      if (current === undefined || current.archivedAt !== null) return fail<string>('student-not-found')
      if (current.version !== input.expectedVersion) return fail<string>('configuration-conflict')
      const updated = await this.repository.updateStudent(transaction, { studentId: input.studentId, fullName: input.fullName, socialName: input.socialName, birthDate: input.birthDate, expectedVersion: input.expectedVersion, updatedAt: this.clock.now() })
      if (updated.length === 0) return fail<string>('configuration-conflict')
      return { status: 'success' as const, value: input.studentId }
    })
    if (result.status === 'failure') return fail<StudentDetail>(result.failure.code)
    return this.get(actor, input.institutionId, result.value)
  }

  /** Arquiva sem apagar autoria e encerra os acompanhamentos na mesma transação. */
  async archive(actor: { readonly userId: string; readonly sessionId: string }, institutionId: string, studentId: string): Promise<Outcome<{ readonly id: string; readonly archivedAt: string }>> {
    return this.database.withTenantOutsideRequest({ institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      await lockInstitutionAuthorization(transaction, institutionId)
      if (!await this.rbac.hasPermissionInTransaction(transaction, actor, institutionId, 'student.update')) return fail('student-not-found')
      const [archived] = await this.repository.archiveStudent(transaction, studentId, actor.userId, this.clock.now())
      if (archived === undefined || archived.archivedAt === null) return fail('student-not-found')
      await this.repository.removeStudentAssignments(transaction, studentId)
      return { status: 'success', value: { id: studentId, archivedAt: archived.archivedAt.toISOString() } }
    })
  }

  /** Reabre o registro mantendo dados e histórico de consentimento anteriores. */
  async unarchive(actor: { readonly userId: string; readonly sessionId: string }, institutionId: string, studentId: string): Promise<Outcome<StudentDetail>> {
    const result = await this.database.withTenantOutsideRequest({ institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      await lockInstitutionAuthorization(transaction, institutionId)
      if (!await this.rbac.hasPermissionInTransaction(transaction, actor, institutionId, 'student.update')) return fail<string>('student-not-found')
      const [student] = await this.repository.unarchiveStudent(transaction, studentId)
      return student === undefined ? fail<string>('student-not-found') : { status: 'success' as const, value: student.id }
    })
    if (result.status === 'failure') return fail<StudentDetail>(result.failure.code)
    return this.get(actor, institutionId, result.value)
  }

  /** Liga ou reutiliza a pessoa responsável sem duplicar um mesmo e-mail institucional. */
  async addGuardian(actor: { readonly userId: string; readonly sessionId: string }, input: AddStudentGuardianInput): Promise<Outcome<StudentDetail>> {
    const result = await this.database.withTenantOutsideRequest({ institutionId: input.institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.rbac.hasPermissionInTransaction(transaction, actor, input.institutionId, 'guardian.link', input.studentId)) return fail<string>('student-not-found')
      const student = await this.repository.findStudent(transaction, input.institutionId, input.studentId)
      if (student === undefined || student.archivedAt !== null) return fail<string>('student-not-found')
      const existing = input.guardian.email === null ? undefined : await this.repository.findGuardianByEmail(transaction, input.institutionId, input.guardian.email)
      let guardian = existing
      if (guardian === undefined) [guardian] = await this.repository.insertGuardian(transaction, { institutionId: input.institutionId, fullName: input.guardian.fullName, email: input.guardian.email, phone: input.guardian.phone, createdByUserId: actor.userId })
      if (guardian === undefined) throw new Error('Guardian insert returned no row')
      const linked = await this.repository.insertStudentGuardian(transaction, input.institutionId, input.studentId, guardian.id, input.guardian.relationship)
      if (linked.length === 0) return fail<string>('guardian-already-linked')
      return { status: 'success' as const, value: input.studentId }
    })
    if (result.status === 'failure') return fail<StudentDetail>(result.failure.code)
    return this.get(actor, input.institutionId, result.value)
  }

  /** Encerra o vínculo familiar e, no último filho, o acesso de ambiente do responsável. */
  async removeGuardian(actor: { readonly userId: string; readonly sessionId: string }, input: RemoveStudentGuardianInput): Promise<Outcome<StudentDetail>> {
    const result = await this.database.withTenantOutsideRequest({ institutionId: input.institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.rbac.hasPermissionInTransaction(transaction, actor, input.institutionId, 'guardian.unlink', input.studentId)) return fail<string>('student-not-found')
      const guardian = await this.repository.findGuardianById(transaction, input.institutionId, input.guardianId)
      if (guardian === undefined) return fail<string>('guardian-not-found')
      const removed = await this.repository.removeStudentGuardian(transaction, input.studentId, input.guardianId)
      if (removed.length === 0) return fail<string>('guardian-not-found')
      const links = (await this.repository.countGuardianLinks(transaction, input.guardianId))[0]?.total ?? 0
      if (links === 0 && guardian.userId !== null) await this.repository.endStudentMembership(transaction, input.institutionId, guardian.userId, actor.userId, this.clock.now())
      return { status: 'success' as const, value: input.studentId }
    })
    if (result.status === 'failure') return fail<StudentDetail>(result.failure.code)
    return this.get(actor, input.institutionId, result.value)
  }

  /** Registra consentimento institucional como evento imutável. */
  async recordConsent(actor: { readonly userId: string; readonly sessionId: string }, input: RecordConsentInput): Promise<Outcome<Consent>> {
    if (input.kind !== 'institution-record' || input.termVersion !== CONSENT_TERMS.institutionRecord || input.signedOn === null || !isValidConsentDocument(input.document)) return fail<Consent>('invalid_input')
    return this.database.withTenantOutsideRequest({ institutionId: input.institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.rbac.hasPermissionInTransaction(transaction, actor, input.institutionId, 'guardian.link', input.studentId)) return fail<Consent>('student-not-found')
      const student = await this.repository.findStudent(transaction, input.institutionId, input.studentId)
      if (student === undefined || student.archivedAt !== null) return fail<Consent>('student-not-found')
      const guardianSnapshot = input.guardianId === null ? undefined : await this.repository.findGuardianSnapshot(transaction, input.studentId, input.guardianId)
      if (input.guardianId !== null && guardianSnapshot === undefined) return fail<Consent>('guardian-not-found')
      const [consent] = await this.repository.insertConsent(transaction, { institutionId: input.institutionId, studentId: input.studentId, kind: input.kind, termVersion: input.termVersion, guardianId: input.guardianId, guardianNameSnapshot: guardianSnapshot?.fullName ?? null, guardianRelationshipSnapshot: guardianSnapshot?.relationship ?? null, signedOn: input.signedOn, documentName: input.document.fileName, documentMediaType: input.document.mediaType, documentBase64: input.document.base64, recordedByUserId: actor.userId })
      if (consent === undefined) throw new Error('Consent insert returned no row')
      return { status: 'success', value: toConsent(consent) }
    })
  }

  /** Entrega o anexo apenas a quem pode gerenciar responsáveis deste estudante. */
  async getConsentDocument(actor: { readonly userId: string; readonly sessionId: string }, input: ConsentPath): Promise<Outcome<ReturnType<typeof consentDocumentSchema.parse>>> {
    if (!await this.rbac.hasPermission(actor, input.institutionId, 'guardian.link', { studentId: input.studentId })) return fail('student-not-found')
    return this.database.withTenantOutsideRequest({ institutionId: input.institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      const consent = await this.repository.findConsentDocument(transaction, input.institutionId, input.studentId, input.consentId)
      if (consent?.documentName === null || consent?.documentName === undefined || consent.documentMediaType === null || consent.documentBase64 === null) return fail('consent-not-found')
      return { status: 'success', value: consentDocumentSchema.parse({ fileName: consent.documentName, mediaType: consent.documentMediaType, base64: consent.documentBase64 }) }
    })
  }

  /** Revoga um evento sem apagar o registro nem alterar consentimentos anteriores. */
  async revokeConsent(actor: { readonly userId: string; readonly sessionId: string }, input: ConsentPath): Promise<Outcome<Consent>> {
    return this.database.withTenantOutsideRequest({ institutionId: input.institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.rbac.hasPermissionInTransaction(transaction, actor, input.institutionId, 'guardian.link', input.studentId)) return fail<Consent>('student-not-found')
      const current = (await this.repository.listStudentConsents(transaction, input.studentId)).find(consent => consent.id === input.consentId)
      if (current === undefined) return fail<Consent>('consent-not-found')
      if (current.revokedAt !== null) return fail<Consent>('consent-already-revoked')
      const [revoked] = await this.repository.revokeConsent(transaction, input.studentId, input.consentId, actor.userId, this.clock.now())
      if (revoked === undefined) return fail<Consent>('consent-already-revoked')
      return { status: 'success', value: toConsent(revoked) }
    })
  }

  /** Troca o conjunto de acompanhantes de uma vez e só aceita vínculos ativos elegíveis. */
  async replaceAssignments(actor: { readonly userId: string; readonly sessionId: string }, input: ReplaceAssignmentsInput): Promise<Outcome<StudentDetail>> {
    const result = await this.database.withTenantOutsideRequest({ institutionId: input.institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.rbac.hasPermissionInTransaction(transaction, actor, input.institutionId, 'assignment.manage')) return fail<string>('student-not-found')
      const student = await this.repository.findStudent(transaction, input.institutionId, input.studentId)
      if (student === undefined) return fail<string>('student-not-found')
      if (student.archivedAt !== null) return fail<string>('student-archived')
      const assignees = await this.repository.findEligibleMemberships(transaction, input.institutionId, input.membershipIds)
      if (assignees.length !== input.membershipIds.length) return fail<string>('assignee-not-eligible')
      await this.repository.replaceAssignments(transaction, input.institutionId, input.studentId, assignees.map(({ id, userId }) => ({ id, userId })))
      return { status: 'success' as const, value: input.studentId }
    })
    if (result.status === 'failure') return fail<StudentDetail>(result.failure.code)
    return this.get(actor, input.institutionId, result.value)
  }

  /** Lista termos vigentes apenas para responsáveis com conta e vínculo ativo. */
  async listPendingConsents(actor: { readonly userId: string; readonly sessionId: string }): Promise<readonly PendingConsent[]> {
    const guarded = await this.listGuardedStudents(actor)
    return guarded.flatMap(({ student, guardianId, consents }) => {
      const institutionConsent = consents.find(consent => consent.kind === 'institution-record' && consent.revokedAt === null)
      if (institutionConsent === undefined) return []
      const confirmation = consents.find(consent => consent.kind === 'guardian-confirmation' && consent.guardianId === guardianId && consent.termVersion === CONSENT_TERMS.guardianConfirmation && consent.revokedAt === null)
      if (confirmation !== undefined) return []
      return [pendingConsentSchema.parse({ student: this.toSummary(student), termVersion: CONSENT_TERMS.guardianConfirmation })]
    })
  }

  /** Confirmações vigentes do próprio responsável, com o id que a revogação pede. */
  async listOwnConsents(actor: { readonly userId: string; readonly sessionId: string }): Promise<readonly OwnConsent[]> {
    const guarded = await this.listGuardedStudents(actor)
    return guarded.flatMap(({ student, guardianId, consents }) => consents
      .filter(consent => consent.kind === 'guardian-confirmation' && consent.guardianId === guardianId && consent.revokedAt === null)
      .map(consent => ownConsentSchema.parse({
        student: this.toSummary(student),
        consent: toConsent(consent),
      })))
  }

  // Estudantes ativos pelos quais o ator responde, em cada instituição onde tem vínculo de
  // aluno. A leitura roda por instituição porque a RLS só enxerga um tenant por vez.
  private async listGuardedStudents(actor: { readonly userId: string; readonly sessionId: string }) {
    const memberships = await this.database.withIdentity({ actorId: actor.userId, sessionId: actor.sessionId }, transaction => this.repository.listStudentMembershipsForUser(transaction, actor.userId))
    const guarded: { student: StudentRecord; guardianId: string; consents: Awaited<ReturnType<StudentsRepository['listStudentConsents']>> }[] = []
    for (const membership of memberships) {
      const rows = await this.database.withTenantOutsideRequest({ institutionId: membership.institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
        const accessible: Awaited<ReturnType<StudentsRepository['listOwnStudents']>> = []
        const pageSize = 50
        for (let offset = 0; ; offset += pageSize) {
          const page = await this.repository.listOwnStudents(transaction, membership.institutionId, actor.userId, undefined, false, pageSize, offset)
          accessible.push(...page)
          if (page.length < pageSize) break
        }
        const found: typeof guarded = []
        for (const { student } of accessible) {
          const guardian = await this.repository.findGuardianForActor(transaction, student.id, actor.userId)
          if (guardian === undefined) continue
          found.push({ student, guardianId: guardian.id, consents: await this.repository.listStudentConsents(transaction, student.id) })
        }
        return found
      })
      guarded.push(...rows)
    }
    return guarded
  }

  private toSummary(student: StudentRecord) {
    return { id: student.id, fullName: student.fullName, socialName: student.socialName, birthDate: student.birthDate, ageRange: this.ageRange(student.birthDate), archivedAt: null }
  }

  /** Confirma a versão vigente somente pelo responsável vinculado ao aluno. */
  async confirmConsent(actor: { readonly userId: string; readonly sessionId: string }, studentId: string): Promise<Outcome<Consent>> {
    const memberships = await this.database.withIdentity({ actorId: actor.userId, sessionId: actor.sessionId }, transaction => this.repository.listStudentMembershipsForUser(transaction, actor.userId))
    for (const membership of memberships) {
      const outcome = await this.database.withTenantOutsideRequest({ institutionId: membership.institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
        await lockInstitutionAuthorization(transaction, membership.institutionId)
        const student = await this.repository.findStudent(transaction, membership.institutionId, studentId)
        if (student === undefined || student.archivedAt !== null) return undefined
        const guardian = await this.repository.findGuardianForActor(transaction, studentId, actor.userId)
        if (guardian === undefined) return undefined
        const consents = await this.repository.listStudentConsents(transaction, studentId)
        if (!consents.some(consent => consent.kind === 'institution-record' && consent.revokedAt === null)) return undefined
        const existing = consents.find(consent => consent.kind === 'guardian-confirmation' && consent.guardianId === guardian.id && consent.termVersion === CONSENT_TERMS.guardianConfirmation && consent.revokedAt === null)
        if (existing !== undefined) return toConsent(existing)
        const guardianSnapshot = await this.repository.findGuardianSnapshot(transaction, studentId, guardian.id)
        if (guardianSnapshot === undefined) return undefined
        const [consent] = await this.repository.insertConsent(transaction, { institutionId: membership.institutionId, studentId, kind: 'guardian-confirmation', termVersion: CONSENT_TERMS.guardianConfirmation, guardianId: guardianIdSchema.parse(guardian.id), guardianNameSnapshot: guardianSnapshot.fullName, guardianRelationshipSnapshot: guardianSnapshot.relationship, signedOn: null, recordedByUserId: actor.userId })
        if (consent === undefined) throw new Error('Consent insert returned no row')
        return toConsent(consent)
      })
      if (outcome !== undefined) return { status: 'success', value: outcome }
    }
    return fail<Consent>('student-not-found')
  }

  /** Permite que o responsável vinculado revogue um consentimento sem intermediação. */
  async revokeOwnConsent(actor: { readonly userId: string; readonly sessionId: string }, input: OwnConsentPath): Promise<Outcome<Consent>> {
    const memberships = await this.database.withIdentity({ actorId: actor.userId, sessionId: actor.sessionId }, transaction => this.repository.listStudentMembershipsForUser(transaction, actor.userId))
    for (const membership of memberships) {
      const consent = await this.database.withTenantOutsideRequest({ institutionId: membership.institutionId, actorId: actor.userId, sessionId: actor.sessionId }, async transaction => {
        await lockInstitutionAuthorization(transaction, membership.institutionId)
        const guardian = await this.repository.findGuardianForActor(transaction, input.studentId, actor.userId)
        if (guardian === undefined) return undefined
        const current = (await this.repository.listStudentConsents(transaction, input.studentId)).find(entry => entry.id === input.consentId)
        if (current === undefined || current.guardianId !== guardian.id || current.revokedAt !== null) return undefined
        const [revoked] = await this.repository.revokeConsent(transaction, input.studentId, input.consentId, actor.userId, this.clock.now())
        if (revoked === undefined) return undefined
        return toConsent(revoked)
      })
      if (consent !== undefined) return { status: 'success', value: consent }
    }
    return fail<Consent>('consent-not-found')
  }

  private ageRange(birthDate: string) {
    const today = this.clock.now().toISOString().slice(0, 10)
    return deriveAgeRange(birthDate, today)
  }

}

type ConsentRow = Awaited<ReturnType<StudentsRepository['listStudentConsents']>>[number]

// O contrato é estrito e a linha do banco tem colunas que não saem pela API (instituição,
// aluno, snapshots, autoria): espalhar a linha no schema derrubava a resposta em 500.
function toConsent(row: ConsentRow): Consent {
  return consentSchema.parse({
    id: row.id,
    kind: row.kind,
    termVersion: row.termVersion,
    guardianId: row.guardianId,
    signedOn: row.signedOn,
    recordedAt: row.recordedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  })
}
