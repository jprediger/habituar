import { createFileRoute } from '@tanstack/react-router'
import { AuthenticationFixture } from '../authentication-fixture.js'

export const Route = createFileRoute('/professional')({ component: ProfessionalRoute })

/** Protege a fixture inicial do ambiente profissional. */
export function ProfessionalRoute() {
  return <AuthenticationFixture route="/professional" />
}
