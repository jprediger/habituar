import { MembershipEnvironment } from '@habituar/core/roles'
import { and, eq } from 'drizzle-orm'
import { DatabaseTransaction } from '../database.js'
import { assignments, membershipRoles, memberships, roles, students, users } from '../schema.js'

// Faixa arbitrária entre as três aceitas por `students.age_range`; nenhuma regra depende
// dela neste marco.
const SEEDED_BIRTH_DATE = '2015-01-01'

/** Um usuário por ambiente institucional, para exercitar login e autorização localmente. */
export const DEVELOPMENT_USERS = {
  student: { email: 'student@habituar.dev', name: 'Estudante de Desenvolvimento' },
  professional: { email: 'professional@habituar.dev', name: 'Profissional de Desenvolvimento' },
  monitor: { email: 'monitor@habituar.dev', name: 'Monitor de Desenvolvimento' },
  coordinator: { email: 'coordinator@habituar.dev', name: 'Coordenador de Desenvolvimento' },
} as const

export type SeededUsers = Readonly<Record<keyof typeof DEVELOPMENT_USERS, string>>

/**
 * Cria um usuário por ambiente com vínculo no template do ambiente, mais a ficha do
 * estudante e a atribuição que dá ao profissional alguém sob o alcance `assigned`.
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

  await ensureMembership(transaction, institutionId, studentUserId, 'student', ['student'])
  const professionalMembershipId = await ensureMembership(transaction, institutionId, professionalUserId, 'professional', ['care-assigned'])
  await ensureMembership(transaction, institutionId, monitorUserId, 'monitor', ['monitoring'])
  await ensureMembership(transaction, institutionId, coordinatorUserId, 'professional', ['team-management', 'care-institution'])

  const studentId = await ensureStudent(transaction, institutionId, studentUserId)
  await ensureAssignment(transaction, institutionId, professionalUserId, professionalMembershipId, studentId)

  return { student: studentUserId, professional: professionalUserId, monitor: monitorUserId, coordinator: coordinatorUserId }
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
