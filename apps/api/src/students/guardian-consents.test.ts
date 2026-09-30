import 'reflect-metadata'
import { consentSchema, ownConsentSchema, pendingConsentSchema } from '@habituar/core/students'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { z } from 'zod'
import { guardians, studentConsents, studentGuardians, students } from '../database/schema.js'
import { Account, ProvisionedInstitution, StaffHarness } from '../database/staff-fixture.js'

const SYSTEM_SESSION = 'c9000000-0000-4000-8000-000000000021'

describe('consentimento pelo responsável', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  let harness: StaffHarness
  let institution: ProvisionedInstitution
  let guardianA: Account
  let guardianB: Account
  let studentAccount: Account
  let careInstitution: Account
  let childOfA = ''
  let childOfB = ''

  // Aluno sem conta, com o responsável vinculado e o consentimento institucional já
  // registrado: é o estado em que a confirmação do responsável fica pendente.
  async function registerChild(fullName: string, guardian: Account, guardianName: string): Promise<string> {
    return harness.database.withTenantOutsideRequest({ institutionId: institution.id, actorId: SYSTEM_SESSION, sessionId: SYSTEM_SESSION }, async (transaction) => {
      const [student] = await transaction.insert(students).values({ institutionId: institution.id, fullName, birthDate: '2014-03-10' }).returning()
      const [guardianRow] = await transaction.insert(guardians).values({ institutionId: institution.id, userId: guardian.userId, fullName: guardianName }).returning()
      if (student === undefined || guardianRow === undefined) throw new Error('Fixture insert returned no row')
      await transaction.insert(studentGuardians).values({ institutionId: institution.id, studentId: student.id, guardianId: guardianRow.id, relationship: 'mother' })
      await transaction.insert(studentConsents).values({ institutionId: institution.id, studentId: student.id, kind: 'institution-record', termVersion: '2026-01', signedOn: '2026-01-10', recordedByUserId: guardian.userId })
      return student.id
    })
  }

  async function ownConsents(account: Account) {
    const response = await harness.call(account, 'GET', '/me/consents')
    expect(response.status).toBe(200)
    return z.array(ownConsentSchema).parse(response.body)
  }

  async function pendingConsents(account: Account) {
    const response = await harness.call(account, 'GET', '/me/consents/pending')
    expect(response.status).toBe(200)
    return z.array(pendingConsentSchema).parse(response.body)
  }

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    institution = await harness.provisionInstitution('Consentimento')
    guardianA = await harness.createAccount('consent-guardian-a@example.test')
    guardianB = await harness.createAccount('consent-guardian-b@example.test')
    studentAccount = await harness.createAccount('consent-student@example.test')
    await harness.addMember(institution.id, guardianA.userId, 'student', [institution.templates.guardian])
    await harness.addMember(institution.id, guardianB.userId, 'student', [institution.templates.guardian])
    await harness.addMember(institution.id, studentAccount.userId, 'student', [institution.templates.student])
    careInstitution = await harness.createAccount('consent-care@example.test')
    await harness.addMember(institution.id, careInstitution.userId, 'professional', [institution.templates['care-institution']])
    childOfA = await registerChild('Filha de A', guardianA, 'Responsável A')
    childOfB = await registerChild('Filho de B', guardianB, 'Responsável B')
  })

  afterAll(async () => {
    await harness.stop()
  })

  it('entrega ao responsável a confirmação que ele fez, com o id que a revogação pede', async () => {
    expect((await pendingConsents(guardianA)).map((entry) => entry.student.id)).toEqual([childOfA])
    expect((await harness.call(guardianA, 'POST', `/me/consents/${childOfA}/confirm`)).status).toBe(200)

    const confirmed = await ownConsents(guardianA)
    expect(confirmed).toHaveLength(1)
    expect(confirmed[0]).toMatchObject({ student: { id: childOfA }, consent: { kind: 'guardian-confirmation', termVersion: '2026-01', revokedAt: null } })
    expect(await pendingConsents(guardianA)).toEqual([])
  })

  it('não mostra nem deixa revogar a confirmação de outro responsável', async () => {
    const [confirmationOfA] = await ownConsents(guardianA)
    if (confirmationOfA === undefined) throw new Error('Expected the confirmation of guardian A')

    expect(await ownConsents(guardianB)).toEqual([])
    const attempt = await harness.call(guardianB, 'POST', `/me/consents/${childOfA}/${confirmationOfA.consent.id}/revoke`)
    expect(attempt.status).toBe(404)
    expect(await ownConsents(guardianA)).toHaveLength(1)
  })

  it('tira a confirmação revogada da lista e devolve a pendência', async () => {
    const [confirmationOfA] = await ownConsents(guardianA)
    if (confirmationOfA === undefined) throw new Error('Expected the confirmation of guardian A')

    expect((await harness.call(guardianA, 'POST', `/me/consents/${childOfA}/${confirmationOfA.consent.id}/revoke`)).status).toBe(200)
    expect(await ownConsents(guardianA)).toEqual([])
    expect((await pendingConsents(guardianA)).map((entry) => entry.student.id)).toEqual([childOfA])
  })

  it('devolve lista vazia a quem é aluno e não responde por ninguém', async () => {
    expect(await ownConsents(studentAccount)).toEqual([])
    expect(await pendingConsents(studentAccount)).toEqual([])
    // O filho de B continua pendente só para B.
    expect((await pendingConsents(guardianB)).map((entry) => entry.student.id)).toEqual([childOfB])
  })

  // O registro pela instituição devolvia a linha inteira do banco num contrato estrito e
  // respondia 500; confirmar e revogar pelo responsável tinham o mesmo defeito.
  it('registra e revoga pela equipe o consentimento institucional, respondendo pelo contrato', async () => {
    const path = `/institutions/${institution.id}/students/${childOfB}/consents`
    const recorded = await harness.call(careInstitution, 'POST', path, { kind: 'institution-record', termVersion: '2026-01', guardianId: null, signedOn: '2026-02-01' })
    expect(recorded.status).toBe(200)
    const consent = consentSchema.parse(recorded.body)
    expect(consent).toMatchObject({ kind: 'institution-record', signedOn: '2026-02-01', revokedAt: null })

    const revoked = await harness.call(careInstitution, 'POST', `${path}/${consent.id}/revoke`)
    expect(revoked.status).toBe(200)
    expect(consentSchema.parse(revoked.body).revokedAt).not.toBeNull()
  })

  it('não expõe consentimentos a quem não tem sessão', async () => {
    expect((await fetch(`${harness.baseUrl}/v1/me/consents`)).status).toBe(401)
  })
})
