import { createFileRoute } from '@tanstack/react-router'
import { AuthenticationFixture } from '../authentication-fixture.js'

export const Route = createFileRoute('/monitor')({ component: MonitorRoute })

/** Protege a fixture inicial do ambiente de monitor. */
export function MonitorRoute() {
  return <AuthenticationFixture route="/monitor" />
}
