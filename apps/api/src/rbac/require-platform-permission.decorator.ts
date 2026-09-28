import { PlatformPermissionKey } from '@habituar/core/permissions'
import { SetMetadata } from '@nestjs/common'

export const PLATFORM_PERMISSION_KEY = 'platform-permission'

/**
 * Só declara qual operação de plataforma a rota exige, no mesmo molde de `@RequirePermission`;
 * a decisão continua exclusiva do `RbacService`, chamado pelo `PermissionGuard`.
 */
export function RequirePlatformPermission(permission: PlatformPermissionKey): MethodDecorator & ClassDecorator {
  return SetMetadata(PLATFORM_PERMISSION_KEY, permission)
}
