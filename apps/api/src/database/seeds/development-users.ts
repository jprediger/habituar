import { MembershipEnvironment } from '@habituar/core/roles'
import { and, eq } from 'drizzle-orm'
import { DatabaseTransaction } from '../database.js'
import { assignments, guardians, routineBlocks, membershipRoles, memberships, roles, studentConsents, studentGuardians, students, users } from '../schema.js'

// Faixa arbitrária entre as três aceitas por `students.age_range`; nenhuma regra depende
// dela neste marco.
const SEEDED_BIRTH_DATE = '2015-01-01'

/** Um usuário por ambiente e papel institucional, para exercitar login e autorização localmente. */
export const DEVELOPMENT_USERS = {
  student: { email: 'student@habituar.dev', name: 'Estudante de Desenvolvimento' },
  professional: { email: 'professional@habituar.dev', name: 'Profissional de Desenvolvimento' },
  monitor: { email: 'monitor@habituar.dev', name: 'Monitor de Desenvolvimento' },
  coordinator: { email: 'coordinator@habituar.dev', name: 'Coordenador de Desenvolvimento' },
  guardian: { email: 'guardian@habituar.dev', name: 'Responsável de Desenvolvimento' },
} as const

export type SeededUsers = Readonly<Record<keyof typeof DEVELOPMENT_USERS, string>>

/**
 * Cria um usuário por ambiente com vínculo no template do ambiente, mais a ficha do
 * estudante, a atribuição que dá ao profissional alguém sob o alcance `assigned` e o
 * responsável com o consentimento institucional registrado, à espera da confirmação dele.
 * Recusa instituição sem templates de papel e não sobrescreve nada que já exista.
 * Exige transação já escopada à instituição — as tabelas escritas aqui têm RLS.
 */
export async function seedDevelopmentUsers(
  transaction: DatabaseTransaction,
  institutionId: string,
  passwordHash: string,
): Promise<SeededUsers> {
  const studentUserId = await ensureUser(transaction, DEVELOPMENT_USERS.student, passwordHash)
  const professionalUserId = await ensureUser(transaction, DEVELOPMENT_USERS.professional, passwordHash)
  const monitorUserId = await ensureUser(transaction, DEVELOPMENT_USERS.monitor, passwordHash)
  const coordinatorUserId = await ensureUser(transaction, DEVELOPMENT_USERS.coordinator, passwordHash)
  const guardianUserId = await ensureUser(transaction, DEVELOPMENT_USERS.guardian, passwordHash)

  await ensureMembership(transaction, institutionId, studentUserId, 'student', ['student'])
  const professionalMembershipId = await ensureMembership(transaction, institutionId, professionalUserId, 'professional', ['care-assigned'])
  await ensureMembership(transaction, institutionId, monitorUserId, 'monitor', ['monitoring'])
  await ensureMembership(transaction, institutionId, coordinatorUserId, 'professional', ['team-management', 'care-institution'])
  await ensureMembership(transaction, institutionId, guardianUserId, 'student', ['guardian'])

  const studentId = await ensureStudent(transaction, institutionId, studentUserId)
  await ensureAssignment(transaction, institutionId, professionalUserId, professionalMembershipId, studentId)
  await ensureGuardianWithInstitutionConsent(transaction, institutionId, guardianUserId, coordinatorUserId, studentId)
  await ensureRoutine(transaction, institutionId, professionalUserId, studentId)

  return { student: studentUserId, professional: professionalUserId, monitor: monitorUserId, coordinator: coordinatorUserId, guardian: guardianUserId }
}

async function ensureUser(
  transaction: DatabaseTransaction,
  specification: Readonly<{ email: string; name: string }>,
  passwordHash: string,
): Promise<string> {
  const existing = await transaction.query.users.findFirst({ where: eq(users.email, specification.email) })
  if (existing !== undefined) return existing.id

  const [user] = await transaction
    .insert(users)
    .values({ email: specification.email, name: specification.name, passwordHash })
    .returning()
  if (user === undefined) throw new Error('Insert into users returned no row')

  return user.id
}

async function ensureMembership(
  transaction: DatabaseTransaction,
  institutionId: string,
  userId: string,
  environment: MembershipEnvironment,
  templateKeys: readonly string[],
): Promise<string> {
  const existing = await transaction.query.memberships.findFirst({
    where: and(eq(memberships.userId, userId), eq(memberships.institutionId, institutionId)),
  })
  const membership = existing ?? (await transaction.insert(memberships).values({ userId, institutionId, environment }).returning())[0]
  if (membership === undefined) throw new Error('Insert into memberships returned no row')
  for (const templateKey of templateKeys) {
    const role = await transaction.query.roles.findFirst({
      where: and(eq(roles.institutionId, institutionId), eq(roles.templateKey, templateKey), eq(roles.environment, environment)),
    })
    if (role === undefined) throw new Error(`Institution has no system role for template "${templateKey}"`)
    await transaction.insert(membershipRoles).values({ membershipId: membership.id, roleId: role.id, institutionId, environment }).onConflictDoNothing()
  }
  return membership.id
}

async function ensureStudent(
  transaction: DatabaseTransaction,
  institutionId: string,
  userId: string,
): Promise<string> {
  const existing = await transaction.query.students.findFirst({ where: eq(students.userId, userId) })
  if (existing !== undefined) return existing.id

  const [student] = await transaction
    .insert(students)
    .values({ institutionId, userId, fullName: 'Estudante de Desenvolvimento', birthDate: SEEDED_BIRTH_DATE })
    .returning()
  if (student === undefined) throw new Error('Insert into students returned no row')

  return student.id
}

async function ensureAssignment(
  transaction: DatabaseTransaction,
  institutionId: string,
  staffUserId: string,
  membershipId: string,
  studentId: string,
): Promise<void> {
  await transaction
    .insert(assignments)
    .values({ institutionId, staffUserId, membershipId, studentId })
    .onConflictDoNothing()
}

async function ensureGuardianWithInstitutionConsent(
  transaction: DatabaseTransaction,
  institutionId: string,
  guardianUserId: string,
  recordedByUserId: string,
  studentId: string,
): Promise<void> {
  const existing = await transaction.query.guardians.findFirst({ where: eq(guardians.userId, guardianUserId) })
  const guardian = existing ?? (await transaction
    .insert(guardians)
    .values({ institutionId, userId: guardianUserId, fullName: DEVELOPMENT_USERS.guardian.name, email: DEVELOPMENT_USERS.guardian.email })
    .returning())[0]
  if (guardian === undefined) throw new Error('Insert into guardians returned no row')
  await transaction.insert(studentGuardians).values({ institutionId, studentId, guardianId: guardian.id, relationship: 'mother' }).onConflictDoNothing()

  const consent = await transaction.query.studentConsents.findFirst({
    where: and(eq(studentConsents.studentId, studentId), eq(studentConsents.kind, 'institution-record')),
  })
  if (consent !== undefined) return
  await transaction.insert(studentConsents).values({
    institutionId,
    studentId,
    kind: 'institution-record',
    termVersion: '2026-01',
    guardianId: guardian.id,
    guardianNameSnapshot: DEVELOPMENT_USERS.guardian.name,
    guardianRelationshipSnapshot: 'mother',
    signedOn: '2026-01-10',
    recordedByUserId,
  })
}

// Semana de exemplo para a aba Rotina não abrir vazia no desenvolvimento local.
const SEEDED_ROUTINE = [
  { weekday: 1, startsAt: '07:30', endsAt: '12:00', title: 'Aulas', kind: 'class' },
  { weekday: 1, startsAt: '14:00', endsAt: '15:00', title: 'Tarefa de casa', kind: 'study' },
  { weekday: 3, startsAt: '07:30', endsAt: '12:00', title: 'Aulas', kind: 'class' },
  { weekday: 3, startsAt: '15:00', endsAt: '15:50', title: 'Atendimento de apoio', kind: 'therapy' },
  { weekday: 5, startsAt: '16:00', endsAt: '17:00', title: 'Natação', kind: 'activity' },
] as const

async function ensureRoutine(transaction: DatabaseTransaction, institutionId: string, professionalUserId: string, studentId: string): Promise<void> {
  const existing = await transaction.query.routineBlocks.findFirst({ where: eq(routineBlocks.studentId, studentId) })
  if (existing !== undefined) return
  const now = new Date()
  await transaction.insert(routineBlocks).values(SEEDED_ROUTINE.map((block) => ({
    ...block,
    institutionId,
    studentId,
    notes: null,
    createdByUserId: professionalUserId,
    updatedByUserId: professionalUserId,
    createdAt: now,
    updatedAt: now,
  })))
}
