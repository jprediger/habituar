import { createFileRoute } from '@tanstack/react-router'
import { AuthenticationFixture } from '../authentication-fixture.js'

export const Route = createFileRoute('/student')({ component: StudentRoute })

/** Protege a fixture inicial do ambiente de aluno. */
export function StudentRoute() {
  return <AuthenticationFixture route="/student" />
}
