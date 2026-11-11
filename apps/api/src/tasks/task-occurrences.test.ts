import 'reflect-metadata'
import { addDays, type LocalDate, localDateInTimeZone } from '@habituar/core/calendar'
import { taskAgendaSchema, taskOccurrenceSchema, taskPhotoContentSchema, taskSchema } from '@habituar/core/tasks'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { DatabaseTransaction } from '../database/database.js'
import { assignments, guardians, studentGuardians, students } from '../database/schema.js'
import { Account, ProvisionedInstitution, StaffHarness } from '../database/staff-fixture.js'

const SYSTEM_SESSION = 'c9000000-0000-4000-8000-000000000071'
// O "hoje" da API é o do fuso da instituição; os casos usam distância de dias dele, longe da virada.
const TODAY = localDateInTimeZone(new Date(Date.now()), 'America/Sao_Paulo')
const PNG = { mediaType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }

function dailyTask(title: string, startsOn: LocalDate) {
  return { task: { title, kind: null, notes: null, schedule: { startsOn, time: { kind: 'all-day' }, recurrence: { kind: 'daily', until: null } } } }
}

describe('registro das ocorrências de tarefa', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  let harness: StaffHarness
  let institution: ProvisionedInstitution
  let careAssigned: Account
  let studentAccount: Account
  let otherStudentAccount: Account
  let guardian: Account
  let studentId = ''
  let staffTaskId = ''
  let ownTaskId = ''

  function tasksPath(id = studentId): string {
    return `/institutions/${institution.id}/students/${id}/tasks`
  }

  function occurrencePath(day: LocalDate, taskId = staffTaskId): string {
    return `${tasksPath()}/${taskId}/occurrences/${day}`
  }

  function inTenant<T>(run: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return harness.database.withTenantOutsideRequest({ institutionId: institution.id, actorId: SYSTEM_SESSION, sessionId: SYSTEM_SESSION }, run)
  }

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    institution = await harness.provisionInstitution('Registros de tarefa')
    careAssigned = await harness.createAccount('occurrences-care@example.test')
    studentAccount = await harness.createAccount('occurrences-student@example.test')
    otherStudentAccount = await harness.createAccount('occurrences-other-student@example.test')
    guardian = await harness.createAccount('occurrences-guardian@example.test')
    const careMembership = await harness.addMember(institution.id, careAssigned.userId, 'professional', [institution.templates['care-assigned']])
    await harness.addMember(institution.id, studentAccount.userId, 'student', [institution.templates.student])
    await harness.addMember(institution.id, otherStudentAccount.userId, 'student', [institution.templates.student])
    await harness.addMember(institution.id, guardian.userId, 'student', [institution.templates.guardian])

    studentId = await inTenant(async (transaction) => {
      const [own] = await transaction.insert(students).values({ institutionId: institution.id, userId: studentAccount.userId, fullName: 'Aluno dos Registros', birthDate: '2013-05-01' }).returning()
      await transaction.insert(students).values({ institutionId: institution.id, userId: otherStudentAccount.userId, fullName: 'Outro Aluno', birthDate: '2013-05-01' })
      const [guardianRow] = await transaction.insert(guardians).values({ institutionId: institution.id, userId: guardian.userId, fullName: 'Responsável' }).returning()
      if (own === undefined || guardianRow === undefined) throw new Error('Fixture insert returned no row')
      await transaction.insert(studentGuardians).values({ institutionId: institution.id, studentId: own.id, guardianId: guardianRow.id, relationship: 'mother' })
      await transaction.insert(assignments).values({ institutionId: institution.id, membershipId: careMembership, staffUserId: careAssigned.userId, studentId: own.id })
      return own.id
    })
    staffTaskId = taskSchema.parse((await harness.call(careAssigned, 'POST', `${tasksPath()}/staff`, dailyTask('Leitura', addDays(TODAY, -30)))).body).id
    ownTaskId = taskSchema.parse((await harness.call(studentAccount, 'POST', `${tasksPath()}/student`, dailyTask('Arrumar a mochila', addDays(TODAY, -30)))).body).id
  })

  afterAll(async () => {
    await harness.stop()
  })

  it('deixa o aluno concluir, escrever a observação e anexar foto, e a equipe e o responsável lerem', async () => {
    const day = addDays(TODAY, -1)
    const completed = taskOccurrenceSchema.parse((await harness.call(studentAccount, 'PUT', `${occurrencePath(day)}/completion`, { expectedVersion: null })).body)
    expect(completed.completedAt).not.toBeNull()
    const noted = await harness.call(studentAccount, 'PUT', `${occurrencePath(day)}/note`, { notes: 'Li dois capítulos', expectedVersion: completed.version })
    expect(noted.status).toBe(200)
    const withPhoto = await harness.call(studentAccount, 'POST', `${occurrencePath(day)}/photos`, { photo: PNG })
    expect(withPhoto.status).toBe(200)
    const [photo] = taskOccurrenceSchema.parse(withPhoto.body).photos
    if (photo === undefined) throw new Error('Photo missing from occurrence')

    for (const reader of [studentAccount, guardian, careAssigned]) {
      const agenda = taskAgendaSchema.parse((await harness.call(reader, 'GET', `${tasksPath()}?from=${day}&to=${day}`)).body)
      expect(agenda.occurrences.find(occurrence => occurrence.taskId === staffTaskId)).toMatchObject({ originalDate: day, notes: 'Li dois capítulos', photos: [{ id: photo.id }] })
      const read = await harness.call(reader, 'GET', `${tasksPath()}/photos/${photo.id}`)
      expect(taskPhotoContentSchema.parse(read.body).base64).toBe(PNG.base64)
    }

    expect((await harness.call(studentAccount, 'DELETE', `${tasksPath()}/photos/${photo.id}`)).status).toBe(200)
    expect((await harness.call(careAssigned, 'GET', `${tasksPath()}/photos/${photo.id}`)).status).toBe(404)
  })

  it('deixa concluir tarefa da equipe e a própria, inclusive de dias anteriores', async () => {
    for (const taskId of [staffTaskId, ownTaskId]) {
      const late = await harness.call(studentAccount, 'PUT', `${occurrencePath(addDays(TODAY, -5), taskId)}/completion`, { expectedVersion: null })
      expect(late.status).toBe(200)
    }
  })

  it('recusa concluir ocorrência que ainda não chegou', async () => {
    expect((await harness.call(studentAccount, 'PUT', `${occurrencePath(addDays(TODAY, 2))}/completion`, { expectedVersion: null })).status).toBe(422)
    expect((await harness.call(studentAccount, 'PUT', `${occurrencePath(addDays(TODAY, 2), ownTaskId)}/completion`, { expectedVersion: null })).status).toBe(422)
  })

  it('conclui a ocorrência remarcada pela data para onde ela foi', async () => {
    const series = taskSchema.parse((await harness.call(careAssigned, 'POST', `${tasksPath()}/staff`, dailyTask('Remarcada', addDays(TODAY, -10)))).body)
    const movedAhead = await harness.call(careAssigned, 'PUT', `${tasksPath()}/staff/${series.id}`, { change: { scope: 'this-occurrence', occurrenceDate: addDays(TODAY, -2), date: addDays(TODAY, 2), time: { kind: 'all-day' } }, expectedVersion: series.version })
    expect(movedAhead.status).toBe(200)
    const movedBack = await harness.call(careAssigned, 'PUT', `${tasksPath()}/staff/${series.id}`, { change: { scope: 'this-occurrence', occurrenceDate: addDays(TODAY, 3), date: addDays(TODAY, -3), time: { kind: 'all-day' } }, expectedVersion: series.version + 1 })
    expect(movedBack.status).toBe(200)

    expect((await harness.call(studentAccount, 'PUT', `${occurrencePath(addDays(TODAY, -2), series.id)}/completion`, { expectedVersion: 1 })).status).toBe(422)
    expect((await harness.call(studentAccount, 'PUT', `${occurrencePath(addDays(TODAY, 3), series.id)}/completion`, { expectedVersion: 1 })).status).toBe(200)
  })

  it('recusa que a equipe ou o responsável concluam ou escrevam no lugar do aluno', async () => {
    const day = addDays(TODAY, -2)
    for (const writer of [careAssigned, guardian]) {
      expect((await harness.call(writer, 'PUT', `${occurrencePath(day)}/completion`, { expectedVersion: null })).status).toBe(403)
      expect((await harness.call(writer, 'PUT', `${occurrencePath(day)}/note`, { notes: 'Escrito por outra pessoa', expectedVersion: null })).status).toBe(403)
      expect((await harness.call(writer, 'POST', `${occurrencePath(day)}/photos`, { photo: PNG })).status).toBe(403)
    }
  })

  it('recusa que um aluno registre na agenda de outro aluno', async () => {
    const day = addDays(TODAY, -2)
    expect((await harness.call(otherStudentAccount, 'PUT', `${occurrencePath(day)}/completion`, { expectedVersion: null })).status).toBe(403)
    expect((await harness.call(otherStudentAccount, 'PUT', `${occurrencePath(day)}/note`, { notes: 'Invasão', expectedVersion: null })).status).toBe(403)
  })

  it('recusa registro em dia fora da série e em ocorrência cancelada', async () => {
    const series = taskSchema.parse((await harness.call(careAssigned, 'POST', `${tasksPath()}/staff`, { task: { title: 'Avulsa', kind: null, notes: null, schedule: { startsOn: addDays(TODAY, -4), time: { kind: 'all-day' }, recurrence: { kind: 'none' } } } })).body)
    expect((await harness.call(studentAccount, 'PUT', `${occurrencePath(addDays(TODAY, -3), series.id)}/note`, { notes: 'Dia errado', expectedVersion: null })).status).toBe(422)

    const cancelled = await harness.call(careAssigned, 'DELETE', `${tasksPath()}/staff/${series.id}`, { removal: { scope: 'this-occurrence', occurrenceDate: addDays(TODAY, -4) }, expectedVersion: series.version })
    expect(cancelled.status).toBe(200)
    expect((await harness.call(studentAccount, 'PUT', `${occurrencePath(addDays(TODAY, -4), series.id)}/completion`, { expectedVersion: 1 })).status).toBe(422)
  })

  it('deixa a equipe avaliar a ocorrência concluída da tarefa da equipe, e o aluno não desfaz depois', async () => {
    const day = addDays(TODAY, -7)
    expect((await harness.call(careAssigned, 'PUT', `${occurrencePath(day)}/evaluation`, { outcome: 'achieved', comment: null, expectedVersion: null })).status).toBe(409)

    const completed = taskOccurrenceSchema.parse((await harness.call(studentAccount, 'PUT', `${occurrencePath(day)}/completion`, { expectedVersion: null })).body)
    const evaluated = await harness.call(careAssigned, 'PUT', `${occurrencePath(day)}/evaluation`, { outcome: 'partial', comment: 'Faltou revisar.', expectedVersion: null })
    expect(evaluated.status).toBe(200)
    expect(taskOccurrenceSchema.parse(evaluated.body).evaluation).toMatchObject({ outcome: 'partial', comment: 'Faltou revisar.', version: 1 })

    expect((await harness.call(studentAccount, 'DELETE', `${occurrencePath(day)}/completion`, { expectedVersion: completed.version })).status).toBe(409)
    expect((await harness.call(careAssigned, 'PUT', `${occurrencePath(day)}/evaluation`, { outcome: 'achieved', comment: null, expectedVersion: 1 })).status).toBe(200)
    expect((await harness.call(careAssigned, 'PUT', `${occurrencePath(day)}/evaluation`, { outcome: 'not-achieved', comment: null, expectedVersion: 1 })).status).toBe(409)
  })

  it('recusa avaliar a tarefa do aluno, mesmo concluída', async () => {
    const day = addDays(TODAY, -8)
    expect((await harness.call(studentAccount, 'PUT', `${occurrencePath(day, ownTaskId)}/completion`, { expectedVersion: null })).status).toBe(200)
    expect((await harness.call(careAssigned, 'PUT', `${occurrencePath(day, ownTaskId)}/evaluation`, { outcome: 'achieved', comment: null, expectedVersion: null })).status).toBe(403)
    const agenda = taskAgendaSchema.parse((await harness.call(careAssigned, 'GET', `${tasksPath()}?from=${day}&to=${day}`)).body)
    expect(agenda.occurrences.find(occurrence => occurrence.taskId === ownTaskId)?.evaluation).toBeNull()
  })

  it('recusa avaliação de quem não tem a permissão', async () => {
    const day = addDays(TODAY, -9)
    await harness.call(studentAccount, 'PUT', `${occurrencePath(day)}/completion`, { expectedVersion: null })
    const evaluation = { outcome: 'achieved', comment: null, expectedVersion: null }
    expect((await harness.call(studentAccount, 'PUT', `${occurrencePath(day)}/evaluation`, evaluation)).status).toBe(403)
    expect((await harness.call(guardian, 'PUT', `${occurrencePath(day)}/evaluation`, evaluation)).status).toBe(403)
    const monitor = await harness.createAccount('occurrences-monitor@example.test')
    await harness.addMember(institution.id, monitor.userId, 'monitor', [institution.templates.monitoring])
    expect((await harness.call(monitor, 'PUT', `${occurrencePath(day)}/evaluation`, evaluation)).status).toBe(403)
  })

  it('recusa arquivo que não é a imagem declarada e foto além do limite', async () => {
    const fake = { mediaType: 'image/png', base64: Buffer.from('not an image at all').toString('base64') }
    expect((await harness.call(studentAccount, 'POST', `${occurrencePath(addDays(TODAY, -10))}/photos`, { photo: fake })).status).toBe(422)
    const day = addDays(TODAY, -11)
    for (let index = 0; index < 6; index += 1) expect((await harness.call(studentAccount, 'POST', `${occurrencePath(day)}/photos`, { photo: PNG })).status).toBe(200)
    expect((await harness.call(studentAccount, 'POST', `${occurrencePath(day)}/photos`, { photo: PNG })).status).toBe(409)
  })

  it('recusa observação gravada sobre uma versão velha', async () => {
    const day = addDays(TODAY, -12)
    const first = taskOccurrenceSchema.parse((await harness.call(studentAccount, 'PUT', `${occurrencePath(day)}/note`, { notes: 'Primeira', expectedVersion: null })).body)
    expect((await harness.call(studentAccount, 'PUT', `${occurrencePath(day)}/note`, { notes: 'Segunda', expectedVersion: first.version })).status).toBe(200)
    expect((await harness.call(studentAccount, 'PUT', `${occurrencePath(day)}/note`, { notes: 'Atrasada', expectedVersion: first.version })).status).toBe(409)
  })
})
