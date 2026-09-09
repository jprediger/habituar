import { createFileRoute } from '@tanstack/react-router'
import { AuthenticationFixture } from '../authentication-fixture.js'

export const Route = createFileRoute('/login')({ component: LoginRoute })

/** Declara a rota conceitual de login enquanto a tela visual ainda não foi definida. */
export function LoginRoute() {
  return <AuthenticationFixture route="/login" />
}
