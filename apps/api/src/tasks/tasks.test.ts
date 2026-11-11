import 'reflect-metadata'
import { addDays, type LocalDate, localDateInTimeZone } from '@habituar/core/calendar'
import { taskAgendaSchema, taskChangeResultSchema, taskOccurrenceSchema, taskRemovalResultSchema, taskSchema } from '@habituar/core/tasks'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { DatabaseTransaction } from '../database/database.js'
import { assignments, guardians, studentGuardians, students } from '../database/schema.js'
import { Account, ProvisionedInstitution, StaffHarness } from '../database/staff-fixture.js'

const SYSTEM_SESSION = 'c9000000-0000-4000-8000-000000000061'
// O "hoje" da API é o do fuso da instituição; os casos usam distância de dias dele, longe da virada.
const TODAY = localDateInTimeZone(new Date(Date.now()), 'America/Sao_Paulo')
const AFTERNOON = { kind: 'timed', startsAt: '14:00', endsAt: '15:00' }

function daily(startsOn: LocalDate, until: LocalDate | null = null) {
  return { startsOn, time: AFTERNOON, recurrence: { kind: 'daily', until } }
}

function once(startsOn: LocalDate) {
  return { startsOn, time: { kind: 'all-day' }, recurrence: { kind: 'none' } }
}

function task(title: string, schedule: unknown) {
  return { title, kind: 'study', notes: null, schedule }
}

describe('séries de tarefa do aluno', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  let harness: StaffHarness
  let institutionA: ProvisionedInstitution
  let institutionB: ProvisionedInstitution
  let careAssigned: Account
  let careInstitution: Account
  let studentAccount: Account
  let otherStudentAccount: Account
  let guardian: Account
  let foreignCare: Account
  let studentId = ''
  let otherStudentId = ''
  let unassignedStudentId = ''

  function tasksPath(id = studentId, institutionId = institutionA.id): string {
    return `/institutions/${institutionId}/students/${id}/tasks`
  }

  function listPath(from: LocalDate, to: LocalDate, id = studentId): string {
    return `${tasksPath(id)}?from=${from}&to=${to}`
  }

  function inTenant<T>(institutionId: string, run: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return harness.database.withTenantOutsideRequest({ institutionId, actorId: SYSTEM_SESSION, sessionId: SYSTEM_SESSION }, run)
  }

  async function createStaffTask(title: string, schedule: unknown) {
    const created = await harness.call(careAssigned, 'POST', `${tasksPath()}/staff`, { task: task(title, schedule) })
    expect(created.status).toBe(200)
    return taskSchema.parse(created.body)
  }

  async function createStudentTask(title: string, schedule: unknown) {
    const created = await harness.call(studentAccount, 'POST', `${tasksPath()}/student`, { task: task(title, schedule) })
    expect(created.status).toBe(200)
    return taskSchema.parse(created.body)
  }

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    institutionA = await harness.provisionInstitution('Tarefas A')
    institutionB = await harness.provisionInstitution('Tarefas B')
    careAssigned = await harness.createAccount('tasks-care-assigned@example.test')
    careInstitution = await harness.createAccount('tasks-care-institution@example.test')
    studentAccount = await harness.createAccount('tasks-student@example.test')
    otherStudentAccount = await harness.createAccount('tasks-other-student@example.test')
    guardian = await harness.createAccount('tasks-guardian@example.test')
    foreignCare = await harness.createAccount('tasks-foreign@example.test')
    const careMembership = await harness.addMember(institutionA.id, careAssigned.userId, 'professional', [institutionA.templates['care-assigned']])
    await harness.addMember(institutionA.id, careInstitution.userId, 'professional', [institutionA.templates['care-institution']])
    await harness.addMember(institutionA.id, studentAccount.userId, 'student', [institutionA.templates.student])
    await harness.addMember(institutionA.id, otherStudentAccount.userId, 'student', [institutionA.templates.student])
    await harness.addMember(institutionA.id, guardian.userId, 'student', [institutionA.templates.guardian])
    await harness.addMember(institutionB.id, foreignCare.userId, 'professional', [institutionB.templates['care-institution']])

    ;[studentId, otherStudentId, unassignedStudentId] = await inTenant(institutionA.id, async (transaction) => {
      const [own] = await transaction.insert(students).values({ institutionId: institutionA.id, userId: studentAccount.userId, fullName: 'Aluno das Tarefas', birthDate: '2013-05-01' }).returning()
      const [other] = await transaction.insert(students).values({ institutionId: institutionA.id, userId: otherStudentAccount.userId, fullName: 'Outro Aluno', birthDate: '2013-05-01' }).returning()
      const [unassigned] = await transaction.insert(students).values({ institutionId: institutionA.id, fullName: 'Aluno Sem Vínculo', birthDate: '2013-05-01' }).returning()
      const [guardianRow] = await transaction.insert(guardians).values({ institutionId: institutionA.id, userId: guardian.userId, fullName: 'Responsável' }).returning()
      if (own === undefined || other === undefined || unassigned === undefined || guardianRow === undefined) throw new Error('Fixture insert returned no row')
      await transaction.insert(studentGuardians).values({ institutionId: institutionA.id, studentId: own.id, guardianId: guardianRow.id, relationship: 'mother' })
      await transaction.insert(assignments).values({ institutionId: institutionA.id, membershipId: careMembership, staffUserId: careAssigned.userId, studentId: own.id })
      return [own.id, other.id, unassigned.id]
    })
  })

  afterAll(async () => {
    await harness.stop()
  })

  it('deixa a equipe criar tarefa da equipe e o aluno a própria, e quem acompanha lê as duas', async () => {
    const staffTask = await createStaffTask('Leitura', daily(addDays(TODAY, -3)))
    const ownTask = await createStudentTask('Arrumar a mochila', once(addDays(TODAY, 1)))
    expect(staffTask).toMatchObject({ origin: 'staff', version: 1 })
    expect(ownTask).toMatchObject({ origin: 'student', version: 1 })

    for (const reader of [studentAccount, guardian, careAssigned, careInstitution]) {
      const listed = await harness.call(reader, 'GET', listPath(TODAY, addDays(TODAY, 1)))
      expect(listed.status).toBe(200)
      expect(taskAgendaSchema.parse(listed.body).tasks.map(item => item.id)).toEqual(expect.arrayContaining([staffTask.id, ownTask.id]))
    }
  })

  it('recusa que o aluno crie, edite ou exclua tarefa da equipe, pela rota de qualquer origem', async () => {
    const staffTask = await createStaffTask('Tarefa da equipe', daily(TODAY))
    const change = { change: { scope: 'from-this-occurrence', occurrenceDate: TODAY, task: task('Mudada pelo aluno', daily(TODAY)) }, expectedVersion: staffTask.version }
    const removal = { removal: { scope: 'this-occurrence', occurrenceDate: TODAY }, expectedVersion: staffTask.version }

    expect((await harness.call(studentAccount, 'POST', `${tasksPath()}/staff`, { task: task('Invasão', daily(TODAY)) })).status).toBe(403)
    expect((await harness.call(studentAccount, 'PUT', `${tasksPath()}/staff/${staffTask.id}`, change)).status).toBe(403)
    expect((await harness.call(studentAccount, 'PUT', `${tasksPath()}/student/${staffTask.id}`, change)).status).toBe(403)
    expect((await harness.call(studentAccount, 'DELETE', `${tasksPath()}/staff/${staffTask.id}`, removal)).status).toBe(403)
    expect((await harness.call(studentAccount, 'DELETE', `${tasksPath()}/student/${staffTask.id}`, removal)).status).toBe(403)
    const [unchanged] = taskAgendaSchema.parse((await harness.call(careAssigned, 'GET', listPath(TODAY, TODAY))).body).tasks.filter(item => item.id === staffTask.id)
    expect(unchanged).toMatchObject({ title: 'Tarefa da equipe', version: 1 })
  })

  it('recusa que a equipe crie, edite ou exclua tarefa do aluno, pela rota de qualquer origem', async () => {
    const ownTask = await createStudentTask('Tarefa do aluno', daily(TODAY))
    const change = { change: { scope: 'from-this-occurrence', occurrenceDate: TODAY, task: task('Mudada pela equipe', daily(TODAY)) }, expectedVersion: ownTask.version }
    const removal = { removal: { scope: 'from-this-occurrence', occurrenceDate: TODAY }, expectedVersion: ownTask.version }

    for (const staff of [careAssigned, careInstitution]) {
      expect((await harness.call(staff, 'POST', `${tasksPath()}/student`, { task: task('Em nome do aluno', daily(TODAY)) })).status).toBe(403)
      expect((await harness.call(staff, 'PUT', `${tasksPath()}/staff/${ownTask.id}`, change)).status).toBe(403)
      expect((await harness.call(staff, 'PUT', `${tasksPath()}/student/${ownTask.id}`, change)).status).toBe(403)
      expect((await harness.call(staff, 'DELETE', `${tasksPath()}/staff/${ownTask.id}`, removal)).status).toBe(403)
    }
    const [unchanged] = taskAgendaSchema.parse((await harness.call(studentAccount, 'GET', listPath(TODAY, TODAY))).body).tasks.filter(item => item.id === ownTask.id)
    expect(unchanged).toMatchObject({ title: 'Tarefa do aluno', version: 1 })
  })

  it('recusa qualquer escrita do responsável, que só lê a agenda', async () => {
    const ownTask = await createStudentTask('Tarefa vista pelo responsável', daily(TODAY))
    const change = { change: { scope: 'from-this-occurrence', occurrenceDate: TODAY, task: task('Mudada pelo responsável', daily(TODAY)) }, expectedVersion: ownTask.version }

    expect((await harness.call(guardian, 'POST', `${tasksPath()}/student`, { task: task('Pelo responsável', daily(TODAY)) })).status).toBe(403)
    expect((await harness.call(guardian, 'POST', `${tasksPath()}/staff`, { task: task('Pelo responsável', daily(TODAY)) })).status).toBe(403)
    expect((await harness.call(guardian, 'PUT', `${tasksPath()}/student/${ownTask.id}`, change)).status).toBe(403)
    expect((await harness.call(guardian, 'DELETE', `${tasksPath()}/student/${ownTask.id}`, { removal: { scope: 'this-occurrence', occurrenceDate: TODAY }, expectedVersion: 1 })).status).toBe(403)
  })

  it('recusa que um aluno escreva na agenda de outro aluno', async () => {
    const ownTask = await createStudentTask('Só minha', daily(TODAY))
    const change = { change: { scope: 'from-this-occurrence', occurrenceDate: TODAY, task: task('Invasão', daily(TODAY)) }, expectedVersion: ownTask.version }

    expect((await harness.call(otherStudentAccount, 'POST', `${tasksPath()}/student`, { task: task('Invasão', daily(TODAY)) })).status).toBe(403)
    expect((await harness.call(otherStudentAccount, 'PUT', `${tasksPath()}/student/${ownTask.id}`, change)).status).toBe(403)
    expect((await harness.call(otherStudentAccount, 'GET', listPath(TODAY, TODAY))).status).toBe(403)
    // Pelo próprio caminho, a série de outro aluno simplesmente não existe.
    expect((await harness.call(otherStudentAccount, 'PUT', `${tasksPath(otherStudentId)}/student/${ownTask.id}`, change)).status).toBe(404)
  })

  it('nega a agenda de aluno sem vínculo, de outra instituição e de quem não tem sessão', async () => {
    expect((await harness.call(careAssigned, 'GET', listPath(TODAY, TODAY, unassignedStudentId))).status).toBe(403)
    expect((await harness.call(careAssigned, 'POST', `${tasksPath(unassignedStudentId)}/staff`, { task: task('Sem vínculo', daily(TODAY)) })).status).toBe(403)
    expect((await harness.call(foreignCare, 'GET', listPath(TODAY, TODAY))).status).toBe(403)
    expect((await fetch(`${harness.baseUrl}/v1${listPath(TODAY, TODAY)}`)).status).toBe(401)
  })

  it('divide a série desta em diante: a antiga termina na véspera do corte e a nova começa nele', async () => {
    const series = await createStaffTask('Leitura diária', daily(addDays(TODAY, -5)))
    const cut = addDays(TODAY, 2)
    const changed = await harness.call(careAssigned, 'PUT', `${tasksPath()}/staff/${series.id}`, {
      change: { scope: 'from-this-occurrence', occurrenceDate: cut, task: { ...task('Leitura à noite', { ...daily(cut), time: { kind: 'timed', startsAt: '19:00', endsAt: '19:30' } }) } },
      expectedVersion: series.version,
    })
    expect(changed.status).toBe(200)
    const result = taskChangeResultSchema.parse(changed.body)
    if (result.scope !== 'from-this-occurrence' || result.previous === null || result.next === null) throw new Error('Expected a split')
    expect(result.previous).toMatchObject({ id: series.id, title: 'Leitura diária', version: 2, schedule: { recurrence: { kind: 'daily', until: addDays(cut, -1) } } })
    expect(result.next).toMatchObject({ origin: 'staff', title: 'Leitura à noite', schedule: { startsOn: cut, recurrence: { kind: 'daily', until: null } } })
  })

  it('recusa dividir ou encerrar a série a partir de uma data passada', async () => {
    const series = await createStaffTask('Série antiga', daily(addDays(TODAY, -5)))
    const past = addDays(TODAY, -2)
    const changed = await harness.call(careAssigned, 'PUT', `${tasksPath()}/staff/${series.id}`, { change: { scope: 'from-this-occurrence', occurrenceDate: past, task: task('Reescrevendo o passado', daily(past)) }, expectedVersion: series.version })
    expect(changed.status).toBe(422)
    expect((await harness.call(careAssigned, 'DELETE', `${tasksPath()}/staff/${series.id}`, { removal: { scope: 'from-this-occurrence', occurrenceDate: past }, expectedVersion: series.version })).status).toBe(422)
  })

  it('mantém na série antiga a ocorrência de hoje já concluída e avança o corte para a seguinte', async () => {
    const series = await createStudentTask('Arrumar o quarto', daily(addDays(TODAY, -3)))
    expect((await harness.call(studentAccount, 'PUT', `${tasksPath()}/${series.id}/occurrences/${TODAY}/completion`, { expectedVersion: null })).status).toBe(200)

    const changed = await harness.call(studentAccount, 'PUT', `${tasksPath()}/student/${series.id}`, { change: { scope: 'from-this-occurrence', occurrenceDate: TODAY, task: task('Arrumar o quarto cedo', daily(TODAY)) }, expectedVersion: series.version })
    expect(changed.status).toBe(200)
    const result = taskChangeResultSchema.parse(changed.body)
    if (result.scope !== 'from-this-occurrence') throw new Error('Expected a series change')
    expect(result.previous?.schedule.recurrence).toEqual({ kind: 'daily', until: TODAY })
    expect(result.next?.schedule.startsOn).toBe(addDays(TODAY, 1))

    const agenda = taskAgendaSchema.parse((await harness.call(studentAccount, 'GET', listPath(TODAY, TODAY))).body)
    expect(agenda.occurrences.find(occurrence => occurrence.originalDate === TODAY && occurrence.taskId === series.id)?.completedAt).not.toBeNull()
  })

  it('remarca e cancela só uma ocorrência, sem mexer no resto da série', async () => {
    const series = await createStaffTask('Natação', daily(addDays(TODAY, 1)))
    const moved = await harness.call(careAssigned, 'PUT', `${tasksPath()}/staff/${series.id}`, { change: { scope: 'this-occurrence', occurrenceDate: addDays(TODAY, 2), date: addDays(TODAY, 3), time: { kind: 'all-day' } }, expectedVersion: series.version })
    expect(moved.status).toBe(200)
    expect(taskChangeResultSchema.parse(moved.body)).toMatchObject({ scope: 'this-occurrence', occurrence: { originalDate: addDays(TODAY, 2), exception: { kind: 'moved', date: addDays(TODAY, 3), time: { kind: 'all-day' } } } })

    const cancelled = await harness.call(careAssigned, 'DELETE', `${tasksPath()}/staff/${series.id}`, { removal: { scope: 'this-occurrence', occurrenceDate: addDays(TODAY, 4) }, expectedVersion: series.version + 1 })
    expect(cancelled.status).toBe(200)
    expect(taskRemovalResultSchema.parse(cancelled.body)).toMatchObject({ scope: 'this-occurrence', occurrence: { exception: { kind: 'cancelled' } } })

    const agenda = taskAgendaSchema.parse((await harness.call(studentAccount, 'GET', listPath(addDays(TODAY, 1), addDays(TODAY, 5)))).body)
    expect(agenda.tasks.find(item => item.id === series.id)).toMatchObject({ version: series.version + 2, schedule: { startsOn: addDays(TODAY, 1), recurrence: { kind: 'daily', until: null } } })
    expect(agenda.occurrences.filter(occurrence => occurrence.taskId === series.id).map(occurrence => occurrence.exception.kind).sort()).toEqual(['cancelled', 'moved'])
  })

  it('recusa cancelar uma ocorrência que já tem registro, para não esconder o que foi escrito', async () => {
    const series = await createStaffTask('Exercícios', daily(addDays(TODAY, -3)))
    const yesterday = addDays(TODAY, -1)
    const completed = taskOccurrenceSchema.parse((await harness.call(studentAccount, 'PUT', `${tasksPath()}/${series.id}/occurrences/${yesterday}/completion`, { expectedVersion: null })).body)
    expect(completed.completedAt).not.toBeNull()
    expect((await harness.call(careAssigned, 'DELETE', `${tasksPath()}/staff/${series.id}`, { removal: { scope: 'this-occurrence', occurrenceDate: yesterday }, expectedVersion: series.version })).status).toBe(409)
  })

  it('edita a partir da versão vista e recusa edição feita sobre versão velha', async () => {
    const series = await createStaffTask('Revisão', once(addDays(TODAY, 5)))
    const edit = { change: { scope: 'from-this-occurrence', occurrenceDate: addDays(TODAY, 5), task: task('Revisão de ciências', once(addDays(TODAY, 6))) }, expectedVersion: series.version }
    const first = await harness.call(careAssigned, 'PUT', `${tasksPath()}/staff/${series.id}`, edit)
    expect(first.status).toBe(200)
    expect(taskChangeResultSchema.parse(first.body)).toMatchObject({ scope: 'from-this-occurrence', previous: null, next: { id: series.id, title: 'Revisão de ciências', version: 2, schedule: { startsOn: addDays(TODAY, 6) } } })
    expect((await harness.call(careInstitution, 'PUT', `${tasksPath()}/staff/${series.id}`, edit)).status).toBe(409)
  })

  it('remove a série inteira quando exclui desta em diante a partir da primeira ocorrência', async () => {
    const series = await createStudentTask('Levar autorização', once(addDays(TODAY, 2)))
    const removed = await harness.call(studentAccount, 'DELETE', `${tasksPath()}/student/${series.id}`, { removal: { scope: 'from-this-occurrence', occurrenceDate: addDays(TODAY, 2) }, expectedVersion: series.version })
    expect(removed.status).toBe(200)
    expect(taskRemovalResultSchema.parse(removed.body)).toEqual({ scope: 'from-this-occurrence', previous: null })
    const agenda = taskAgendaSchema.parse((await harness.call(studentAccount, 'GET', listPath(addDays(TODAY, 2), addDays(TODAY, 2)))).body)
    expect(agenda.tasks.map(item => item.id)).not.toContain(series.id)
  })

  it('recusa agenda inválida na API e no banco', async () => {
    const backwards = { ...daily(TODAY), time: { kind: 'timed', startsAt: '15:00', endsAt: '14:00' } }
    expect((await harness.call(careAssigned, 'POST', `${tasksPath()}/staff`, { task: task('Invertida', backwards) })).status).toBe(400)
    await expect(inTenant(institutionA.id, (transaction) =>
      transaction.execute(sql`insert into tasks (institution_id, student_id, origin, title, starts_on, time_kind, starts_at, ends_at, recurrence_kind, created_by_user_id, updated_by_user_id, created_at, updated_at) values (${institutionA.id}, ${studentId}, 'staff', 'Invertida', ${TODAY}, 'timed', '15:00', '14:00', 'none', ${careAssigned.userId}, ${careAssigned.userId}, now(), now())`),
    )).rejects.toThrow()
    // Semanal que começa fora dos dias escolhidos: o banco recusa o mesmo que a borda.
    await expect(inTenant(institutionA.id, (transaction) =>
      transaction.execute(sql`insert into tasks (institution_id, student_id, origin, title, starts_on, time_kind, recurrence_kind, recurrence_weekdays, created_by_user_id, updated_by_user_id, created_at, updated_at) values (${institutionA.id}, ${studentId}, 'staff', 'Fora do dia', '2026-11-11', 'all-day', 'weekly', '{1}', ${careAssigned.userId}, ${careAssigned.userId}, now(), now())`),
    )).rejects.toThrow()
  })
})
