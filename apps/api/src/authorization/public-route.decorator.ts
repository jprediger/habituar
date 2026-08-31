import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_ROUTE = 'habituar:is-public-route'

/** Única forma de escapar do `AuthenticationGuard`. A lista de usos é curta de propósito. */
export const PublicRoute = () => SetMetadata(IS_PUBLIC_ROUTE, true)
