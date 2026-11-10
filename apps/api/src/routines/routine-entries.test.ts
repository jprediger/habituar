import 'reflect-metadata'
import { routineEntryPhotoContentSchema, routineEntrySchema } from '@habituar/core/routine-entries'
import { routineBlockSchema } from '@habituar/core/routines'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { z } from 'zod'
import { DatabaseTransaction } from '../database/database.js'
import { assignments, guardians, studentGuardians, students } from '../database/schema.js'
import { Account, ProvisionedInstitution, StaffHarness } from '../database/staff-fixture.js'

const SYSTEM_SESSION = 'c9000000-0000-4000-8000-000000000051'
// Segunda-feira, para o bloco de `weekday: 1`.
const MONDAY = '2026-11-09'
const TUESDAY = '2026-11-10'
const BLOCK = { weekday: 1, startsAt: '14:00', endsAt: '15:00', title: 'Leitura', kind: 'study', notes: null }
const PNG = { mediaType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }

describe('registros do aluno sobre as tarefas da rotina', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  let harness: StaffHarness
  let institution: ProvisionedInstitution
  let careAssigned: Account
  let studentAccount: Account
  let otherStudentAccount: Account
  let guardian: Account
  let studentId = ''
  let otherStudentId = ''
  let blockId = ''

  function routinePath(id = studentId): string {
    return `/institutions/${institution.id}/students/${id}/routine`
  }

  function occurrencePath(day = MONDAY, block = blockId, id = studentId): string {
    return `${routinePath(id)}/${block}/entries/${day}`
  }

  function inTenant<T>(run: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return harness.database.withTenantOutsideRequest({ institutionId: institution.id, actorId: SYSTEM_SESSION, sessionId: SYSTEM_SESSION }, run)
  }

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    institution = await harness.provisionInstitution('Registros')
    careAssigned = await harness.createAccount('entries-care@example.test')
    studentAccount = await harness.createAccount('entries-student@example.test')
    otherStudentAccount = await harness.createAccount('entries-other-student@example.test')
    guardian = await harness.createAccount('entries-guardian@example.test')
    const careMembership = await harness.addMember(institution.id, careAssigned.userId, 'professional', [institution.templates['care-assigned']])
    await harness.addMember(institution.id, studentAccount.userId, 'student', [institution.templates.student])
    await harness.addMember(institution.id, otherStudentAccount.userId, 'student', [institution.templates.student])
    await harness.addMember(institution.id, guardian.userId, 'student', [institution.templates.guardian])

    ;[studentId, otherStudentId] = await inTenant(async (transaction) => {
      const [own] = await transaction.insert(students).values({ institutionId: institution.id, userId: studentAccount.userId, fullName: 'Aluno dos Registros', birthDate: '2013-05-01' }).returning()
      const [other] = await transaction.insert(students).values({ institutionId: institution.id, userId: otherStudentAccount.userId, fullName: 'Outro Aluno', birthDate: '2013-05-01' }).returning()
      const [guardianRow] = await transaction.insert(guardians).values({ institutionId: institution.id, userId: guardian.userId, fullName: 'Responsável' }).returning()
      if (own === undefined || other === undefined || guardianRow === undefined) throw new Error('Fixture insert returned no row')
      await transaction.insert(studentGuardians).values({ institutionId: institution.id, studentId: own.id, guardianId: guardianRow.id, relationship: 'mother' })
      await transaction.insert(assignments).values({ institutionId: institution.id, membershipId: careMembership, staffUserId: careAssigned.userId, studentId: own.id })
      return [own.id, other.id]
    })
    const created = await harness.call(careAssigned, 'POST', routinePath(), { block: BLOCK })
    blockId = routineBlockSchema.parse(created.body).id
  })

  afterAll(async () => {
    await harness.stop()
  })

  it('deixa o aluno escrever a observação do dia e a equipe e o responsável lerem', async () => {
    const saved = await harness.call(studentAccount, 'PUT', `${occurrencePath()}/note`, { notes: 'Li dois capítulos', expectedVersion: null })
    expect(saved.status).toBe(200)
    expect(routineEntrySchema.parse(saved.body)).toMatchObject({ routineBlockId: blockId, occursOn: MONDAY, notes: 'Li dois capítulos', version: 1 })

    for (const reader of [studentAccount, guardian, careAssigned]) {
      const listed = await harness.call(reader, 'GET', `${routinePath()}/entries?from=2026-11-09&to=2026-11-15`)
      expect(listed.status).toBe(200)
      expect(z.array(routineEntrySchema).parse(listed.body).map(entry => entry.notes)).toEqual(['Li dois capítulos'])
    }
  })

  it('anexa, mostra e remove uma foto da tarefa', async () => {
    const added = await harness.call(studentAccount, 'POST', `${occurrencePath()}/photos`, { photo: PNG })
    expect(added.status).toBe(200)
    const [photo] = routineEntrySchema.parse(added.body).photos
    if (photo === undefined) throw new Error('Photo missing from entry')

    const read = await harness.call(careAssigned, 'GET', `${routinePath()}/entries/photos/${photo.id}`)
    expect(read.status).toBe(200)
    expect(routineEntryPhotoContentSchema.parse(read.body).base64).toBe(PNG.base64)

    expect((await harness.call(studentAccount, 'DELETE', `${routinePath()}/entries/photos/${photo.id}`)).status).toBe(200)
    expect((await harness.call(careAssigned, 'GET', `${routinePath()}/entries/photos/${photo.id}`)).status).toBe(404)
  })

  it('recusa escrita do responsável e da equipe: o registro é a voz do próprio aluno', async () => {
    for (const writer of [guardian, careAssigned]) {
      expect((await harness.call(writer, 'PUT', `${occurrencePath(MONDAY)}/note`, { notes: 'Escrito por outra pessoa', expectedVersion: 1 })).status).toBe(403)
      expect((await harness.call(writer, 'POST', `${occurrencePath(MONDAY)}/photos`, { photo: PNG })).status).toBe(403)
    }
  })

  it('recusa que um aluno escreva no registro de outro aluno', async () => {
    expect((await harness.call(otherStudentAccount, 'PUT', `${occurrencePath()}/note`, { notes: 'Invasão', expectedVersion: 1 })).status).toBe(403)
    expect((await harness.call(studentAccount, 'GET', `${routinePath(otherStudentId)}/entries?from=2026-11-09&to=2026-11-15`)).status).toBe(403)
  })

  it('recusa registro num dia em que o bloco não acontece', async () => {
    const saved = await harness.call(studentAccount, 'PUT', `${occurrencePath(TUESDAY)}/note`, { notes: 'Dia errado', expectedVersion: null })
    expect(saved.status).toBe(422)
  })

  it('recusa arquivo que não é a imagem declarada', async () => {
    const fake = { mediaType: 'image/png', base64: Buffer.from('not an image at all').toString('base64') }
    expect((await harness.call(studentAccount, 'POST', `${occurrencePath()}/photos`, { photo: fake })).status).toBe(422)
  })

  it('recusa foto além do limite por tarefa', async () => {
    const day = '2026-11-16'
    for (let index = 0; index < 6; index += 1) expect((await harness.call(studentAccount, 'POST', `${occurrencePath(day)}/photos`, { photo: PNG })).status).toBe(200)
    expect((await harness.call(studentAccount, 'POST', `${occurrencePath(day)}/photos`, { photo: PNG })).status).toBe(409)
  })

  it('recusa observação gravada sobre uma versão velha', async () => {
    const day = '2026-11-23'
    const first = routineEntrySchema.parse((await harness.call(studentAccount, 'PUT', `${occurrencePath(day)}/note`, { notes: 'Primeira', expectedVersion: null })).body)
    expect((await harness.call(studentAccount, 'PUT', `${occurrencePath(day)}/note`, { notes: 'Segunda', expectedVersion: first.version })).status).toBe(200)
    expect((await harness.call(studentAccount, 'PUT', `${occurrencePath(day)}/note`, { notes: 'Atrasada', expectedVersion: first.version })).status).toBe(409)
  })
})
