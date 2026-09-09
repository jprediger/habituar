import { z } from 'zod'

/** Ambiente institucional que define a superfície inicial de um papel. */
export const roleEnvironmentSchema = z.enum(['student', 'professional', 'monitor'])

export type RoleEnvironment = z.infer<typeof roleEnvironmentSchema>
