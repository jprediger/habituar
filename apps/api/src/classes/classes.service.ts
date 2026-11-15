import { type ClassDetail, type ClassSummary, classDetailSchema, classListSchema, classSummarySchema, type ClassStaffPath, type ClassStudentPath, type CreateClassInput, type ListClassesInput, type UpdateClassInput, type ChangeClassStatusInput } from '@habituar/core/classes'
import { type FailureCode, type Outcome } from '@habituar/core/failure'
import { classIdSchema, membershipIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import { Injectable } from '@nestjs/common'
import type { Actor } from '../authorization/authentication.guard.js'
import { lockInstitutionAuthorization } from '../database/authorization-lock.js'
import { Database, type DatabaseTransaction } from '../database/database.js'
import { Clock } from '../platform/clock.js'
import { RbacService } from '../rbac/rbac.service.js'
import { ClassesRepository } from './classes.repository.js'

function fail(code: FailureCode): Outcome<never> {
  return { status: 'failure', failure: { code, message: code } }
}

function success<T>(value: T): Outcome<T> {
  return { status: 'success', value }
}

/** Autoriza alteração na instituição, mesmo quando a chamada veio da tela mobile. */
@Injectable()
export class ClassesService {
  constructor(
    private readonly database: Database,
    private readonly repository: ClassesRepository,
    private readonly rbac: RbacService,
    private readonly clock: Clock,
  ) {}

  private async canRead(transaction: DatabaseTransaction, actor: Actor, institutionId: string, classId?: string): Promise<{ all: boolean; assignedIds: Set<string> } | undefined> {
    const scopes = await this.rbac.listPermissionScopesInTransaction(transaction, actor, institutionId, 'class.read')
    if (scopes.includes('institution')) return { all: true, assignedIds: new Set<string>() }
    if (!scopes.includes('assigned')) return undefined
    const links = await this.repository.assignedClassIds(transaction, actor.userId)
    const assignedIds = new Set(links.map(link => link.classId))
    return classId !== undefined && !assignedIds.has(classId) ? undefined : { all: false, assignedIds }
  }

  private async canManage(transaction: DatabaseTransaction, actor: Actor, institutionId: string, permission: 'class.create' | 'class.manage'): Promise<boolean> {
    return this.rbac.hasPermissionInTransaction(transaction, actor, institutionId, permission)
  }

  private async detail(transaction: DatabaseTransaction, institutionId: string, classId: string): Promise<ClassDetail | undefined> {
    const rows = await this.repository.list(transaction, institutionId, 'all', classId)
    const row = rows.find(entry => entry.id === classId)
    if (row === undefined) return undefined
    const [enrollments, staff] = await Promise.all([
      this.repository.listEnrollments(transaction, classId),
      this.repository.listStaff(transaction, classId),
    ])
    return classDetailSchema.parse({
      ...this.toSummary(row),
      enrollments: enrollments.map(entry => ({ studentId: studentIdSchema.parse(entry.studentId), name: entry.name, enrolledAt: entry.enrolledAt.toISOString(), leftAt: entry.leftAt?.toISOString() ?? null })),
      staff: staff.map(entry => ({ membershipId: membershipIdSchema.parse(entry.membershipId), name: entry.name, environment: entry.environment, linkedAt: entry.linkedAt.toISOString(), leftAt: entry.leftAt?.toISOString() ?? null })),
    })
  }

  private toSummary(row: Awaited<ReturnType<ClassesRepository['list']>>[number]): ClassSummary {
    return classSummarySchema.parse({ ...row, id: classIdSchema.parse(row.id), archivedAt: row.archivedAt?.toISOString() ?? null })
  }

  async list(actor: Actor, input: ListClassesInput): Promise<Outcome<readonly ClassSummary[]>> {
    return this.database.withTenant(async transaction => {
      const access = await this.canRead(transaction, actor, input.institutionId)
      if (access === undefined) return fail('forbidden')
      const rows = await this.repository.list(transaction, input.institutionId, input.archived ? 'archived' : 'active')
      return success(classListSchema.parse(rows.filter(row => access.all || access.assignedIds.has(row.id)).map(row => this.toSummary(row))))
    })
  }

  async get(actor: Actor, institutionId: string, classId: string): Promise<Outcome<ClassDetail>> {
    return this.database.withTenant(async transaction => {
      const access = await this.canRead(transaction, actor, institutionId, classId)
      if (access === undefined) return fail('class-not-found')
      const detail = await this.detail(transaction, institutionId, classId)
      return detail === undefined ? fail('class-not-found') : success(detail)
    })
  }

  async create(actor: Actor, input: CreateClassInput): Promise<Outcome<ClassDetail>> {
    return this.database.withTenant(async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.canManage(transaction, actor, input.institutionId, 'class.create')) return fail('forbidden')
      if (await this.repository.findActiveName(transaction, input.institutionId, input.name) !== undefined) return fail('conflict')
      const [row] = await this.repository.create(transaction, { ...input, actorId: actor.userId, now: this.clock.now() })
      if (row === undefined) throw new Error('Class insert returned no row')
      const detail = await this.detail(transaction, input.institutionId, row.id)
      if (detail === undefined) throw new Error('New class is not visible')
      return success(detail)
    })
  }

  async update(actor: Actor, input: UpdateClassInput): Promise<Outcome<ClassDetail>> {
    return this.database.withTenant(async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.canManage(transaction, actor, input.institutionId, 'class.manage')) return fail('forbidden')
      const current = await this.repository.find(transaction, input.institutionId, input.classId)
      if (current === undefined) return fail('class-not-found')
      if (current.archivedAt !== null) return fail('class-archived')
      if (current.version !== input.expectedVersion) return fail('configuration-conflict')
      const other = await this.repository.findActiveName(transaction, input.institutionId, input.name)
      if (other !== undefined && other.id !== input.classId) return fail('conflict')
      const updated = await this.repository.update(transaction, input.classId, input.expectedVersion, { name: input.name, description: input.description, actorId: actor.userId, now: this.clock.now() })
      if (updated.length === 0) return fail('configuration-conflict')
      const detail = await this.detail(transaction, input.institutionId, input.classId)
      if (detail === undefined) throw new Error('Updated class is not visible')
      return success(detail)
    })
  }

  async archive(actor: Actor, input: ChangeClassStatusInput, archived: boolean): Promise<Outcome<ClassDetail>> {
    return this.database.withTenant(async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.canManage(transaction, actor, input.institutionId, 'class.manage')) return fail('forbidden')
      const current = await this.repository.find(transaction, input.institutionId, input.classId)
      if (current === undefined) return fail('class-not-found')
      if (current.version !== input.expectedVersion) return fail('configuration-conflict')
      if ((current.archivedAt !== null) === archived) return fail('conflict')
      if (!archived && await this.repository.findActiveName(transaction, input.institutionId, current.name) !== undefined) return fail('conflict')
      const now = this.clock.now()
      const changed = await this.repository.setArchived(transaction, input.classId, input.expectedVersion, archived ? now : null, actor.userId, now)
      if (changed.length === 0) return fail('configuration-conflict')
      if (archived) await this.repository.closeClassLinks(transaction, input.classId, now, actor.userId)
      const detail = await this.detail(transaction, input.institutionId, input.classId)
      if (detail === undefined) throw new Error('Class status update is not visible')
      return success(detail)
    })
  }

  async enrollStudent(actor: Actor, input: ClassStudentPath): Promise<Outcome<ClassDetail>> {
    return this.database.withTenant(async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.canManage(transaction, actor, input.institutionId, 'class.manage')) return fail('forbidden')
      const target = await this.repository.find(transaction, input.institutionId, input.classId)
      if (target === undefined) return fail('class-not-found')
      if (target.archivedAt !== null) return fail('class-archived')
      if (await this.repository.student(transaction, input.institutionId, input.studentId) === undefined) return fail('student-not-found')
      const active = await this.repository.activeStudentEnrollment(transaction, input.institutionId, input.studentId)
      if (active?.classId !== input.classId) {
        const now = this.clock.now()
        if (active !== undefined) await this.repository.endEnrollment(transaction, input.institutionId, input.studentId, now, actor.userId)
        await this.repository.addEnrollment(transaction, input.institutionId, input.classId, input.studentId, now, actor.userId)
      }
      const detail = await this.detail(transaction, input.institutionId, input.classId)
      if (detail === undefined) throw new Error('Enrolled class is not visible')
      return success(detail)
    })
  }

  async removeStudent(actor: Actor, input: ClassStudentPath): Promise<Outcome<ClassDetail>> {
    return this.database.withTenant(async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.canManage(transaction, actor, input.institutionId, 'class.manage')) return fail('forbidden')
      const current = await this.repository.find(transaction, input.institutionId, input.classId)
      if (current === undefined) return fail('class-not-found')
      if (current.archivedAt !== null) return fail('class-archived')
      const removed = await this.repository.leaveEnrollment(transaction, input.classId, input.studentId, this.clock.now(), actor.userId)
      if (removed.length === 0) return fail('student-not-found')
      const detail = await this.detail(transaction, input.institutionId, input.classId)
      if (detail === undefined) throw new Error('Class was not visible after removal')
      return success(detail)
    })
  }

  async assignStaff(actor: Actor, input: ClassStaffPath): Promise<Outcome<ClassDetail>> {
    return this.database.withTenant(async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.canManage(transaction, actor, input.institutionId, 'class.manage')) return fail('forbidden')
      const target = await this.repository.find(transaction, input.institutionId, input.classId)
      if (target === undefined) return fail('class-not-found')
      if (target.archivedAt !== null) return fail('class-archived')
      const member = await this.repository.membership(transaction, input.institutionId, input.membershipId)
      if (member === undefined || member.environment === 'student') return fail('assignee-not-eligible')
      if (await this.repository.activeStaffLink(transaction, input.classId, input.membershipId) === undefined) {
        await this.repository.addStaff(transaction, input.institutionId, input.classId, input.membershipId, member.environment, this.clock.now(), actor.userId)
      }
      const detail = await this.detail(transaction, input.institutionId, input.classId)
      if (detail === undefined) throw new Error('Assigned class is not visible')
      return success(detail)
    })
  }

  async removeStaff(actor: Actor, input: ClassStaffPath): Promise<Outcome<ClassDetail>> {
    return this.database.withTenant(async transaction => {
      await lockInstitutionAuthorization(transaction, input.institutionId)
      if (!await this.canManage(transaction, actor, input.institutionId, 'class.manage')) return fail('forbidden')
      const target = await this.repository.find(transaction, input.institutionId, input.classId)
      if (target === undefined) return fail('class-not-found')
      if (target.archivedAt !== null) return fail('class-archived')
      const removed = await this.repository.removeStaff(transaction, input.classId, input.membershipId, this.clock.now(), actor.userId)
      if (removed.length === 0) return fail('member-not-found')
      const detail = await this.detail(transaction, input.institutionId, input.classId)
      if (detail === undefined) throw new Error('Class was not visible after removal')
      return success(detail)
    })
  }
}
