import { SetMetadata } from '@nestjs/common'
import type { PermissionKey } from '@habituar/core/permissions'

export const PERMISSION_KEY = 'habituar:required-permission'

/** Único jeito de exigir permissão numa rota. Comparar papel em outro lugar é erro (D). */
export const RequirePermission = (permission: PermissionKey) => SetMetadata(PERMISSION_KEY, permission)
