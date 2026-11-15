import { Injectable } from '@nestjs/common'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import type { DatabaseTransaction } from '../database/database.js'
import { classEnrollments, classes, classStaffMembers, memberships, students, users } from '../database/schema.js'

/** A RLS delimita a instituição. As FKs compostas impedem vínculos entre tenants. */
@Injectable()
export class ClassesRepository {
  list(transaction: DatabaseTransaction, institutionId: string, status: 'active' | 'archived' | 'all', classId?: string) {
    return transaction.select({
      id: classes.id,
      name: classes.name,
      description: classes.description,
      version: classes.version,
      archivedAt: classes.archivedAt,
      studentCount: sql<number>`(select count(*)::integer from class_enrollments ce where ce.class_id = "classes"."id" and ce.left_at is null)`,
      staffCount: sql<number>`(select count(*)::integer from class_staff_members cs join memberships m on m.id = cs.membership_id where cs.class_id = "classes"."id" and cs.left_at is null and m.removed_at is null)`,
    }).from(classes).where(and(eq(classes.institutionId, institutionId), classId === undefined ? undefined : eq(classes.id, classId), status === 'all' ? sql`true` : status === 'archived' ? sql`${classes.archivedAt} is not null` : isNull(classes.archivedAt))).orderBy(asc(classes.name))
  }

  find(transaction: DatabaseTransaction, institutionId: string, classId: string) {
    return transaction.query.classes.findFirst({ where: and(eq(classes.institutionId, institutionId), eq(classes.id, classId)) })
  }

  findActiveName(transaction: DatabaseTransaction, institutionId: string, name: string) {
    return transaction.query.classes.findFirst({ where: and(eq(classes.institutionId, institutionId), sql`lower(${classes.name}) = lower(${name})`, isNull(classes.archivedAt)) })
  }

  assignedClassIds(transaction: DatabaseTransaction, userId: string) {
    return transaction.select({ classId: classStaffMembers.classId }).from(classStaffMembers)
      .innerJoin(memberships, eq(memberships.id, classStaffMembers.membershipId))
      .where(and(eq(memberships.userId, userId), isNull(memberships.removedAt), isNull(classStaffMembers.leftAt)))
  }

  listEnrollments(transaction: DatabaseTransaction, classId: string) {
    return transaction.select({
      studentId: classEnrollments.studentId,
      name: students.fullName,
      enrolledAt: classEnrollments.enrolledAt,
      leftAt: classEnrollments.leftAt,
    }).from(classEnrollments).innerJoin(students, eq(students.id, classEnrollments.studentId))
      .where(eq(classEnrollments.classId, classId)).orderBy(desc(classEnrollments.enrolledAt))
  }

  listStaff(transaction: DatabaseTransaction, classId: string) {
    return transaction.select({
      membershipId: classStaffMembers.membershipId,
      name: users.name,
      environment: memberships.environment,
      linkedAt: classStaffMembers.linkedAt,
      leftAt: classStaffMembers.leftAt,
    }).from(classStaffMembers)
      .innerJoin(memberships, eq(memberships.id, classStaffMembers.membershipId))
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(classStaffMembers.classId, classId)).orderBy(desc(classStaffMembers.linkedAt))
  }

  student(transaction: DatabaseTransaction, institutionId: string, studentId: string) {
    return transaction.query.students.findFirst({ where: and(eq(students.institutionId, institutionId), eq(students.id, studentId), isNull(students.archivedAt)) })
  }

  membership(transaction: DatabaseTransaction, institutionId: string, membershipId: string) {
    return transaction.query.memberships.findFirst({ where: and(eq(memberships.institutionId, institutionId), eq(memberships.id, membershipId), isNull(memberships.removedAt)) })
  }

  activeStudentEnrollment(transaction: DatabaseTransaction, institutionId: string, studentId: string) {
    return transaction.query.classEnrollments.findFirst({ where: and(eq(classEnrollments.institutionId, institutionId), eq(classEnrollments.studentId, studentId), isNull(classEnrollments.leftAt)) })
  }

  activeStaffLink(transaction: DatabaseTransaction, classId: string, membershipId: string) {
    return transaction.query.classStaffMembers.findFirst({ where: and(eq(classStaffMembers.classId, classId), eq(classStaffMembers.membershipId, membershipId), isNull(classStaffMembers.leftAt)) })
  }

  create(transaction: DatabaseTransaction, input: { institutionId: string; name: string; description: string | null; actorId: string; now: Date }) {
    return transaction.insert(classes).values({ institutionId: input.institutionId, name: input.name, description: input.description, createdByUserId: input.actorId, updatedByUserId: input.actorId, createdAt: input.now, updatedAt: input.now }).returning({ id: classes.id })
  }

  update(transaction: DatabaseTransaction, classId: string, expectedVersion: number, input: { name: string; description: string | null; actorId: string; now: Date }) {
    return transaction.update(classes).set({ name: input.name, description: input.description, version: sql`${classes.version} + 1`, updatedByUserId: input.actorId, updatedAt: input.now })
      .where(and(eq(classes.id, classId), eq(classes.version, expectedVersion), isNull(classes.archivedAt))).returning({ id: classes.id })
  }

  setArchived(transaction: DatabaseTransaction, classId: string, expectedVersion: number, archivedAt: Date | null, actorId: string, now: Date) {
    return transaction.update(classes).set({ archivedAt, version: sql`${classes.version} + 1`, updatedByUserId: actorId, updatedAt: now })
      .where(and(eq(classes.id, classId), eq(classes.version, expectedVersion), archivedAt === null ? sql`${classes.archivedAt} is not null` : isNull(classes.archivedAt)))
      .returning({ id: classes.id })
  }

  endEnrollment(transaction: DatabaseTransaction, institutionId: string, studentId: string, now: Date, actorId: string) {
    return transaction.update(classEnrollments).set({ leftAt: now, changedByUserId: actorId })
      .where(and(eq(classEnrollments.institutionId, institutionId), eq(classEnrollments.studentId, studentId), isNull(classEnrollments.leftAt)))
      .returning({ classId: classEnrollments.classId })
  }

  addEnrollment(transaction: DatabaseTransaction, institutionId: string, classId: string, studentId: string, now: Date, actorId: string) {
    return transaction.insert(classEnrollments).values({ institutionId, classId, studentId, enrolledAt: now, changedByUserId: actorId })
  }

  leaveEnrollment(transaction: DatabaseTransaction, classId: string, studentId: string, now: Date, actorId: string) {
    return transaction.update(classEnrollments).set({ leftAt: now, changedByUserId: actorId })
      .where(and(eq(classEnrollments.classId, classId), eq(classEnrollments.studentId, studentId), isNull(classEnrollments.leftAt)))
      .returning({ id: classEnrollments.id })
  }

  addStaff(transaction: DatabaseTransaction, institutionId: string, classId: string, membershipId: string, environment: 'professional' | 'monitor', now: Date, actorId: string) {
    return transaction.insert(classStaffMembers).values({ institutionId, classId, membershipId, environment, linkedAt: now, changedByUserId: actorId })
  }

  removeStaff(transaction: DatabaseTransaction, classId: string, membershipId: string, now: Date, actorId: string) {
    return transaction.update(classStaffMembers).set({ leftAt: now, changedByUserId: actorId })
      .where(and(eq(classStaffMembers.classId, classId), eq(classStaffMembers.membershipId, membershipId), isNull(classStaffMembers.leftAt)))
      .returning({ id: classStaffMembers.id })
  }

  closeClassLinks(transaction: DatabaseTransaction, classId: string, now: Date, actorId: string) {
    return Promise.all([
      transaction.update(classEnrollments).set({ leftAt: now, changedByUserId: actorId }).where(and(eq(classEnrollments.classId, classId), isNull(classEnrollments.leftAt))),
      transaction.update(classStaffMembers).set({ leftAt: now, changedByUserId: actorId }).where(and(eq(classStaffMembers.classId, classId), isNull(classStaffMembers.leftAt))),
    ])
  }
}
