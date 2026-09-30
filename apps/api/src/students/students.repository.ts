import { Injectable } from '@nestjs/common'
import { and, asc, count, countDistinct, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { DatabaseTransaction } from '../database/database.js'
import { assignments, guardians, students, studentGuardians, memberships, studentConsents, users, invitations } from '../database/schema.js'

export type StudentRecord = typeof students.$inferSelect

/** Consultas de alunos, sempre limitadas pela RLS e pelo alcance SQL recebido. */
@Injectable()
export class StudentsRepository {
  listInstitutionStudents(transaction: DatabaseTransaction, institutionId: string, search: string | undefined, archived: boolean, limit: number, offset: number) {
    return transaction.select({ student: students }).from(students).where(and(eq(students.institutionId, institutionId), archived ? sql`${students.archivedAt} IS NOT NULL` : isNull(students.archivedAt), search === undefined ? undefined : ilike(students.fullName, `%${search}%`))).orderBy(asc(students.fullName), asc(students.id)).limit(limit).offset(offset)
  }

  listAssignedStudents(transaction: DatabaseTransaction, institutionId: string, membershipId: string, search: string | undefined, archived: boolean, limit: number, offset: number) {
    return transaction.selectDistinct({ student: students }).from(students).innerJoin(assignments, eq(assignments.studentId, students.id))
      .where(and(eq(students.institutionId, institutionId), eq(assignments.membershipId, membershipId), archived ? sql`${students.archivedAt} IS NOT NULL` : isNull(students.archivedAt), search === undefined ? undefined : ilike(students.fullName, `%${search}%`)))
      .orderBy(asc(students.fullName), asc(students.id)).limit(limit).offset(offset)
  }

  listOwnStudents(transaction: DatabaseTransaction, institutionId: string, userId: string, search: string | undefined, archived: boolean, limit: number, offset: number) {
    return transaction.selectDistinct({ student: students }).from(students).leftJoin(studentGuardians, eq(studentGuardians.studentId, students.id)).leftJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
      .where(and(eq(students.institutionId, institutionId), or(eq(students.userId, userId), eq(guardians.userId, userId)), archived ? sql`${students.archivedAt} IS NOT NULL` : isNull(students.archivedAt), search === undefined ? undefined : ilike(students.fullName, `%${search}%`)))
      .orderBy(asc(students.fullName), asc(students.id)).limit(limit).offset(offset)
  }

  listOwnOrAssignedStudents(transaction: DatabaseTransaction, institutionId: string, userId: string, membershipId: string | undefined, search: string | undefined, archived: boolean, limit: number, offset: number) {
    const access = membershipId === undefined
      ? or(eq(students.userId, userId), eq(guardians.userId, userId))
      : or(eq(students.userId, userId), eq(guardians.userId, userId), eq(assignments.membershipId, membershipId))
    return transaction.selectDistinct({ student: students }).from(students).leftJoin(studentGuardians, eq(studentGuardians.studentId, students.id)).leftJoin(guardians, eq(guardians.id, studentGuardians.guardianId)).leftJoin(assignments, eq(assignments.studentId, students.id))
      .where(and(eq(students.institutionId, institutionId), access, archived ? sql`${students.archivedAt} IS NOT NULL` : isNull(students.archivedAt), search === undefined ? undefined : ilike(students.fullName, `%${search}%`)))
      .orderBy(asc(students.fullName), asc(students.id)).limit(limit).offset(offset)
  }

  countOwnOrAssignedStudents(transaction: DatabaseTransaction, institutionId: string, userId: string, membershipId: string | undefined, search: string | undefined, archived: boolean) {
    const access = membershipId === undefined
      ? or(eq(students.userId, userId), eq(guardians.userId, userId))
      : or(eq(students.userId, userId), eq(guardians.userId, userId), eq(assignments.membershipId, membershipId))
    return transaction.select({ total: countDistinct(students.id) }).from(students).leftJoin(studentGuardians, eq(studentGuardians.studentId, students.id)).leftJoin(guardians, eq(guardians.id, studentGuardians.guardianId)).leftJoin(assignments, eq(assignments.studentId, students.id))
      .where(and(eq(students.institutionId, institutionId), access, archived ? sql`${students.archivedAt} IS NOT NULL` : isNull(students.archivedAt), search === undefined ? undefined : ilike(students.fullName, `%${search}%`)))
  }

  countInstitutionStudents(transaction: DatabaseTransaction, institutionId: string, search: string | undefined, archived: boolean) {
    return transaction.select({ total: count() }).from(students).where(and(eq(students.institutionId, institutionId), archived ? sql`${students.archivedAt} IS NOT NULL` : isNull(students.archivedAt), search === undefined ? undefined : ilike(students.fullName, `%${search}%`)))
  }

  countAssignedStudents(transaction: DatabaseTransaction, institutionId: string, membershipId: string, search: string | undefined, archived: boolean) {
    return transaction.select({ total: countDistinct(students.id) }).from(students).innerJoin(assignments, eq(assignments.studentId, students.id))
      .where(and(eq(students.institutionId, institutionId), eq(assignments.membershipId, membershipId), archived ? sql`${students.archivedAt} IS NOT NULL` : isNull(students.archivedAt), search === undefined ? undefined : ilike(students.fullName, `%${search}%`)))
  }

  countOwnStudents(transaction: DatabaseTransaction, institutionId: string, userId: string, search: string | undefined, archived: boolean) {
    return transaction.select({ total: countDistinct(students.id) }).from(students).leftJoin(studentGuardians, eq(studentGuardians.studentId, students.id)).leftJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
      .where(and(eq(students.institutionId, institutionId), or(eq(students.userId, userId), eq(guardians.userId, userId)), archived ? sql`${students.archivedAt} IS NOT NULL` : isNull(students.archivedAt), search === undefined ? undefined : ilike(students.fullName, `%${search}%`)))
  }

  findStudent(transaction: DatabaseTransaction, institutionId: string, studentId: string) {
    return transaction.query.students.findFirst({ where: and(eq(students.institutionId, institutionId), eq(students.id, studentId)) })
  }

  findOwnStudent(transaction: DatabaseTransaction, institutionId: string, studentId: string, userId: string) {
    return transaction.select({ id: students.id }).from(students).leftJoin(studentGuardians, eq(studentGuardians.studentId, students.id)).leftJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
      .where(and(eq(students.institutionId, institutionId), eq(students.id, studentId), isNull(students.archivedAt), or(eq(students.userId, userId), eq(guardians.userId, userId)))).limit(1).then(rows => rows[0])
  }

  async findActiveMembership(transaction: DatabaseTransaction, institutionId: string, userId: string) {
    return transaction.query.memberships.findFirst({ where: and(eq(memberships.institutionId, institutionId), eq(memberships.userId, userId), isNull(memberships.removedAt)) })
  }

  listStudentMembershipsForUser(transaction: DatabaseTransaction, userId: string) {
    return transaction.query.memberships.findMany({ where: and(eq(memberships.userId, userId), eq(memberships.environment, 'student'), isNull(memberships.removedAt)) })
  }

  findGuardianForActor(transaction: DatabaseTransaction, studentId: string, userId: string) {
    return transaction.select({ id: guardians.id }).from(studentGuardians).innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
      .where(and(eq(studentGuardians.studentId, studentId), eq(guardians.userId, userId))).limit(1).then(rows => rows[0])
  }

  listGuardians(transaction: DatabaseTransaction, studentId: string) {
    return transaction.select({ id: guardians.id, fullName: guardians.fullName, email: guardians.email, phone: guardians.phone, relationship: studentGuardians.relationship })
      .from(studentGuardians).innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId)).where(eq(studentGuardians.studentId, studentId))
  }

  findAssignment(transaction: DatabaseTransaction, membershipId: string, studentId: string) {
    return transaction.query.assignments.findFirst({ where: and(eq(assignments.membershipId, membershipId), eq(assignments.studentId, studentId)) })
  }

  findCurrentInstitutionConsent(transaction: DatabaseTransaction, studentId: string) {
    return transaction.query.studentConsents.findFirst({ columns: { documentBase64: false }, where: and(eq(studentConsents.studentId, studentId), eq(studentConsents.kind, 'institution-record'), isNull(studentConsents.revokedAt)) })
  }

  findPendingStudentInvitation(transaction: DatabaseTransaction, studentId: string, now: Date) {
    return transaction.query.invitations.findFirst({ where: and(eq(invitations.studentId, studentId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt), sql`${invitations.expiresAt} > ${now}`) })
  }

  listStudentAssignments(transaction: DatabaseTransaction, studentId: string) {
    return transaction.select({ id: assignments.id, membershipId: memberships.id, name: users.name, environment: memberships.environment })
      .from(assignments).innerJoin(memberships, eq(memberships.id, assignments.membershipId)).innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(assignments.studentId, studentId), isNull(memberships.removedAt)))
  }

  listStudentConsents(transaction: DatabaseTransaction, studentId: string) {
    return transaction.query.studentConsents.findMany({ columns: { documentBase64: false }, where: eq(studentConsents.studentId, studentId), orderBy: (consent, { desc }) => [desc(consent.recordedAt)] })
  }

  insertStudent(transaction: DatabaseTransaction, input: Readonly<{ institutionId: string; fullName: string; socialName: string | null; birthDate: string; createdByUserId: string }>) {
    return transaction.insert(students).values(input).returning()
  }

  updateStudent(transaction: DatabaseTransaction, input: Readonly<{ studentId: string; fullName: string; socialName: string | null; birthDate: string; expectedVersion: number; updatedAt: Date }>) {
    return transaction.update(students).set({ fullName: input.fullName, socialName: input.socialName, birthDate: input.birthDate, version: sql`${students.version} + 1`, updatedAt: input.updatedAt })
      .where(and(eq(students.id, input.studentId), eq(students.version, input.expectedVersion), isNull(students.archivedAt))).returning()
  }

  archiveStudent(transaction: DatabaseTransaction, studentId: string, actorId: string, archivedAt: Date) {
    return transaction.update(students).set({ archivedAt, archivedByUserId: actorId, version: sql`${students.version} + 1` }).where(and(eq(students.id, studentId), isNull(students.archivedAt))).returning()
  }

  unarchiveStudent(transaction: DatabaseTransaction, studentId: string) {
    return transaction.update(students).set({ archivedAt: null, archivedByUserId: null, version: sql`${students.version} + 1` }).where(and(eq(students.id, studentId), sql`${students.archivedAt} IS NOT NULL`)).returning()
  }

  removeStudentAssignments(transaction: DatabaseTransaction, studentId: string) {
    return transaction.delete(assignments).where(eq(assignments.studentId, studentId))
  }

  findGuardianByEmail(transaction: DatabaseTransaction, institutionId: string, email: string) {
    return transaction.query.guardians.findFirst({ where: and(eq(guardians.institutionId, institutionId), sql`lower(${guardians.email}) = lower(${email})`) })
  }

  findGuardianById(transaction: DatabaseTransaction, institutionId: string, guardianId: string) {
    return transaction.query.guardians.findFirst({ where: and(eq(guardians.institutionId, institutionId), eq(guardians.id, guardianId)) })
  }

  findStudentGuardian(transaction: DatabaseTransaction, studentId: string, guardianId: string) {
    return transaction.query.studentGuardians.findFirst({ where: and(eq(studentGuardians.studentId, studentId), eq(studentGuardians.guardianId, guardianId)) })
  }

  findGuardianSnapshot(transaction: DatabaseTransaction, studentId: string, guardianId: string) {
    return transaction.select({ fullName: guardians.fullName, relationship: studentGuardians.relationship }).from(studentGuardians)
      .innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
      .where(and(eq(studentGuardians.studentId, studentId), eq(studentGuardians.guardianId, guardianId))).limit(1).then(rows => rows[0])
  }

  insertGuardian(transaction: DatabaseTransaction, input: Readonly<{ institutionId: string; fullName: string; email: string | null; phone: string | null; createdByUserId: string }>) {
    return transaction.insert(guardians).values(input).returning()
  }

  insertStudentGuardian(transaction: DatabaseTransaction, institutionId: string, studentId: string, guardianId: string, relationship: string) {
    return transaction.insert(studentGuardians).values({ institutionId, studentId, guardianId, relationship }).onConflictDoNothing().returning()
  }

  removeStudentGuardian(transaction: DatabaseTransaction, studentId: string, guardianId: string) {
    return transaction.delete(studentGuardians).where(and(eq(studentGuardians.studentId, studentId), eq(studentGuardians.guardianId, guardianId))).returning()
  }

  countGuardianLinks(transaction: DatabaseTransaction, guardianId: string) {
    return transaction.select({ total: count() }).from(studentGuardians).where(eq(studentGuardians.guardianId, guardianId))
  }

  endStudentMembership(transaction: DatabaseTransaction, institutionId: string, userId: string, actorId: string, removedAt: Date) {
    return transaction.update(memberships).set({ removedAt, removedByUserId: actorId, version: sql`${memberships.version} + 1` })
      .where(and(eq(memberships.institutionId, institutionId), eq(memberships.userId, userId), eq(memberships.environment, 'student'), isNull(memberships.removedAt))).returning()
  }

  findConsentDocument(transaction: DatabaseTransaction, institutionId: string, studentId: string, consentId: string) {
    return transaction.query.studentConsents.findFirst({ where: and(eq(studentConsents.institutionId, institutionId), eq(studentConsents.studentId, studentId), eq(studentConsents.id, consentId), eq(studentConsents.kind, 'institution-record')) })
  }

  insertConsent(transaction: DatabaseTransaction, input: Readonly<{ institutionId: string; studentId: string; kind: string; termVersion: string; guardianId: string | null; guardianNameSnapshot: string | null; guardianRelationshipSnapshot: string | null; signedOn: string | null; documentName?: string | null; documentMediaType?: string | null; documentBase64?: string | null; recordedByUserId: string }>) {
    return transaction.insert(studentConsents).values(input).returning()
  }

  revokeConsent(transaction: DatabaseTransaction, studentId: string, consentId: string, actorId: string, revokedAt: Date) {
    return transaction.update(studentConsents).set({ revokedAt, revokedByUserId: actorId }).where(and(eq(studentConsents.studentId, studentId), eq(studentConsents.id, consentId), isNull(studentConsents.revokedAt))).returning()
  }

  findEligibleMemberships(transaction: DatabaseTransaction, institutionId: string, ids: readonly string[]) {
    return ids.length === 0 ? Promise.resolve([]) : transaction.query.memberships.findMany({ where: and(eq(memberships.institutionId, institutionId), inArray(memberships.id, [...ids]), inArray(memberships.environment, ['professional', 'monitor']), isNull(memberships.removedAt)) })
  }

  async replaceAssignments(transaction: DatabaseTransaction, institutionId: string, studentId: string, assignees: readonly Readonly<{ id: string; userId: string }>[]) {
    await transaction.delete(assignments).where(and(eq(assignments.institutionId, institutionId), eq(assignments.studentId, studentId)))
    if (assignees.length > 0) await transaction.insert(assignments).values(assignees.map(({ id: membershipId, userId: staffUserId }) => ({ institutionId, studentId, membershipId, staffUserId })))
  }
}
