import type { z } from 'zod'
import { defineIdSchema } from './branded-id.js'

/**
 * Ids concretos do domínio de autenticação e RBAC. Cada um com brand próprio — trocar
 * um por outro é erro de compilação, nunca bug de produção.
 */
export const institutionIdSchema = defineIdSchema('InstitutionId')
export type InstitutionId = z.infer<typeof institutionIdSchema>

export const userIdSchema = defineIdSchema('UserId')
export type UserId = z.infer<typeof userIdSchema>

export const sessionIdSchema = defineIdSchema('SessionId')
export type SessionId = z.infer<typeof sessionIdSchema>

export const roleIdSchema = defineIdSchema('RoleId')
export type RoleId = z.infer<typeof roleIdSchema>

export const membershipIdSchema = defineIdSchema('MembershipId')
export type MembershipId = z.infer<typeof membershipIdSchema>

export const studentIdSchema = defineIdSchema('StudentId')
export type StudentId = z.infer<typeof studentIdSchema>

export const guardianIdSchema = defineIdSchema('GuardianId')
export type GuardianId = z.infer<typeof guardianIdSchema>

export const assignmentIdSchema = defineIdSchema('AssignmentId')
export type AssignmentId = z.infer<typeof assignmentIdSchema>
