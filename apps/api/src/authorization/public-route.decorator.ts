import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_ROUTE = 'habituar:is-public-route'

export const PublicRoute = () => SetMetadata(IS_PUBLIC_ROUTE, true)
