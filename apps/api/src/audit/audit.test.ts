import 'reflect-metadata'
import { Pool, PoolClient } from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { Account, ProvisionedInstitution, StaffHarness } from '../database/staff-fixture.js'

const FROM = '2023-08-01'
const TO = '2023-08-03'
const MISSING_STUDENT = 'a1000000-0000-4000-8000-000000000016'
const PERMISSION_DENIED = '42501'

type ReadEventRow = Readonly<{
  actor_user_id: string | null
  session_id: string | null
  permission: string
  purpose: string
  subject_type: string
  subject_id: string
  student_ids: string[]
}>

type WriteEventRow = Readonly<{
  institution_id: string | null
  actor_user_id: string | null
  session_id: string | null
  operation: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}>

describe('trilha de auditoria', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  let harness: StaffHarness
  let applicationPool: Pool
  let north: ProvisionedInstitution
  let south: ProvisionedInstitution
  let care: Account
  let outsider: Account
  let foreign: Account
  let careSession = ''
  let studentId = ''

  function recordPath(path = ''): string {
    return `/institutions/${north.id}/students/${studentId}/record${path}`
  }

  async function readEvents(): Promise<ReadEventRow[]> {
    return harness.ownerQuery<ReadEventRow>(
      `select actor_user_id, session_id, permission, purpose, subject_type, subject_id, student_ids::text[] as student_ids
       from audit_read_events where $1 = any(student_ids) order by occurred_at, purpose`,
      [studentId],
    )
  }

  // Conexão crua como o papel da aplicação: é por ela que um bug ou uma injeção tentaria
  // apagar o próprio rastro.
  async function asApplication<T>(institutionId: string | undefined, run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await applicationPool.connect()
    try {
      await client.query('begin')
      if (institutionId !== undefined) await client.query("select set_config('app.institution_id', $1, true)", [institutionId])
      return await run(client)
    } finally {
      await client.query('rollback')
      client.release()
    }
  }

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    applicationPool = new Pool({ connectionString: applicationUrl })
    north = await harness.provisionInstitution('Auditoria Norte')
    south = await harness.provisionInstitution('Auditoria Sul')
    care = await harness.createAccount('audit-care@example.test')
    outsider = await harness.createAccount('audit-outsider@example.test')
    foreign = await harness.createAccount('audit-foreign@example.test')
    await harness.addMember(north.id, care.userId, 'professional', [north.templates['care-institution']])
    await harness.addMember(north.id, outsider.userId, 'professional', [north.templates['care-assigned']])
    await harness.addMember(south.id, foreign.userId, 'professional', [south.templates['care-institution']])
    const [student] = await harness.tenantQuery<{ id: string }>(north.id, 'insert into students (institution_id, full_name, birth_date) values ($1, $2, $3) returning id', [north.id, 'Aluno Auditado', '2013-01-01'])
    if (student === undefined) throw new Error('Student fixture was not inserted')
    studentId = student.id
    const [session] = await harness.ownerQuery<{ id: string }>('select id from sessions where user_id = $1 order by created_at desc limit 1', [care.userId])
    if (session === undefined) throw new Error('Session fixture was not found')
    careSession = session.id
  })

  afterAll(async () => {
    await applicationPool.end()
    await harness.stop()
  })

  it('registra quem abriu a ficha, o histórico e as consultas, com a sessão usada', async () => {
    expect((await harness.call(care, 'GET', recordPath())).status).toBe(200)
    expect((await harness.call(care, 'GET', recordPath('/history'))).status).toBe(200)
    expect((await harness.call(care, 'GET', recordPath('/consultations'))).status).toBe(200)

    const events = await readEvents()
    expect(events.map((event) => event.purpose).sort()).toEqual(['consultations.view', 'history.view', 'record.view'])
    for (const event of events) {
      expect(event).toMatchObject({
        actor_user_id: care.userId, session_id: careSession, permission: 'record.read',
        subject_type: 'student', subject_id: studentId, student_ids: [studentId],
      })
    }
  })

  it('não registra leitura que foi negada ou não encontrou o aluno', async () => {
    const before = (await readEvents()).length
    expect((await harness.call(outsider, 'GET', recordPath())).status).toBe(403)
    expect((await harness.call(foreign, 'GET', recordPath())).status).toBe(403)
    expect((await harness.call(care, 'GET', `/institutions/${north.id}/students/${MISSING_STUDENT}/record`)).status).toBe(404)
    expect(await readEvents()).toHaveLength(before)
    expect(await harness.ownerQuery('select 1 from audit_read_events where subject_id = $1', [MISSING_STUDENT])).toEqual([])
  })

  it('registra relatório visto e exportado com todos os alunos servidos', async () => {
    const query = `from=${FROM}&to=${TO}`
    expect((await harness.call(care, 'GET', `/institutions/${north.id}/reports?${query}`)).status).toBe(200)
    expect((await harness.call(care, 'POST', `/institutions/${north.id}/reports/pdf`, { institutionId: north.id, from: FROM, to: TO })).status).toBe(200)

    const reports = (await readEvents()).filter((event) => event.purpose.startsWith('report.'))
    expect(reports).toEqual([
      expect.objectContaining({ purpose: 'report.view', permission: 'report.read', subject_type: 'institution', subject_id: north.id, actor_user_id: care.userId }),
      expect.objectContaining({ purpose: 'report.export', permission: 'report.export', subject_type: 'institution', subject_id: north.id, actor_user_id: care.userId }),
    ])
  })

  it('registra a escrita da ficha com ator, sessão, instituição e conteúdo gravado', async () => {
    expect((await harness.call(care, 'POST', recordPath('/observations'), { body: 'Leu em voz alta sem ajuda' })).status).toBe(200)

    const [event] = await harness.ownerQuery<WriteEventRow>(
      `select institution_id, actor_user_id, session_id, operation, before, after from audit_write_events
       where table_name = 'student_observations' and after ->> 'student_id' = $1`,
      [studentId],
    )
    expect(event).toMatchObject({ institution_id: north.id, actor_user_id: care.userId, session_id: careSession, operation: 'insert', before: null })
    expect(event?.after).toMatchObject({ body: 'Leu em voz alta sem ajuda', author_user_id: care.userId })
  })

  it('guarda só as colunas alteradas e ignora atualização que não muda nada', async () => {
    await harness.tenantQuery(north.id, 'update students set full_name = $2 where id = $1', [studentId, 'Aluno Renomeado'])
    await harness.tenantQuery(north.id, 'update students set full_name = full_name where id = $1', [studentId])

    const updates = await harness.ownerQuery<WriteEventRow>(
      "select institution_id, actor_user_id, session_id, operation, before, after from audit_write_events where table_name = 'students' and row_id = $1 and operation = 'update'",
      [studentId],
    )
    expect(updates).toHaveLength(1)
    expect(updates[0]?.before).toEqual({ full_name: 'Aluno Auditado' })
    expect(updates[0]?.after).toEqual({ full_name: 'Aluno Renomeado' })
  })

  it('não copia hash de senha para a trilha', async () => {
    const [event] = await harness.ownerQuery<{ password: unknown }>(
      "select after -> 'password_hash' as password from audit_write_events where table_name = 'users' and row_id = $1 and operation = 'insert'",
      [care.userId],
    )
    expect(event?.password).toBe('[redacted]')
    const leaked = await harness.ownerQuery(
      "select 1 from audit_write_events, users where audit_write_events.table_name = 'users' and users.id = $1 and audit_write_events::text like '%' || users.password_hash || '%'",
      [care.userId],
    )
    expect(leaked).toEqual([])
  })

  it('não deixa o papel da aplicação alterar, apagar ou forjar eventos', async () => {
    const [partition] = await harness.ownerQuery<{ name: string }>(
      "select child.relname as name from pg_inherits join pg_class child on child.oid = pg_inherits.inhrelid where pg_inherits.inhparent = 'audit_read_events'::regclass limit 1",
    )
    if (partition === undefined) throw new Error('No audit partition exists')
    const attempts = [
      'update audit_write_events set actor_user_id = null',
      'delete from audit_write_events',
      'truncate audit_write_events',
      "insert into audit_write_events (table_name, operation) values ('students', 'delete')",
      'update audit_read_events set actor_user_id = null',
      'delete from audit_read_events',
      `insert into audit_read_events (institution_id, permission, purpose, subject_type, subject_id, student_ids) values ('${north.id}', 'record.read', 'record.view', 'student', '${studentId}', '{}')`,
      `delete from "${partition.name}"`,
      `select * from "${partition.name}"`,
      "select audit_ensure_read_partition(now() + interval '1 year')",
    ]
    for (const attempt of attempts) {
      await expect(asApplication(north.id, (client) => client.query(attempt)), attempt).rejects.toMatchObject({ code: PERMISSION_DENIED })
    }
  })

  it('não mostra a trilha de uma instituição à outra', async () => {
    const count = (institutionId: string) => asApplication(institutionId, async (client) => {
      const writes = await client.query<{ total: string }>('select count(*) as total from audit_write_events where institution_id = $1', [north.id])
      const reads = await client.query<{ total: string }>('select count(*) as total from audit_read_events where institution_id = $1', [north.id])
      return [Number(writes.rows[0]?.total), Number(reads.rows[0]?.total)]
    })
    const [ownWrites, ownReads] = await count(north.id)
    expect(ownWrites).toBeGreaterThan(0)
    expect(ownReads).toBeGreaterThan(0)
    expect(await count(south.id)).toEqual([0, 0])
  })

  it('recusa registrar leitura sensível fora de um tenant', async () => {
    await expect(asApplication(undefined, (client) => client.query(
      "select audit_record_sensitive_read('record.read', 'record.view', 'student', $1::uuid, array[$1::uuid])",
      [studentId],
    ))).rejects.toThrow('Sensitive read requires a tenant context')
  })

  it('cria a partição do mês sob demanda e descarta as vencidas', async () => {
    await harness.ownerQuery("select audit_ensure_read_partition('2019-03-10T12:00:00Z')")
    const [created] = await harness.ownerQuery<{ exists: boolean; writable: boolean }>(
      "select to_regclass('audit_read_events_2019_03') is not null as exists, has_table_privilege('habituar_app', 'audit_read_events_2019_03', 'DELETE') as writable",
    )
    expect(created).toEqual({ exists: true, writable: false })

    await harness.ownerQuery("select audit_ensure_read_partition('2025-01-10T12:00:00Z')")
    const [dropped] = await harness.ownerQuery<{ exists: boolean }>("select to_regclass('audit_read_events_2019_03') is not null as exists")
    expect(dropped).toEqual({ exists: false })
  })
})
