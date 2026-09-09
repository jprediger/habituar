import { createFileRoute } from '@tanstack/react-router'
import { AuthenticationFixture } from '../authentication-fixture.js'

export const Route = createFileRoute('/select-institution')({ component: SelectInstitutionRoute })

/** Declara a rota conceitual de escolha institucional sem implementar o seletor visual. */
export function SelectInstitutionRoute() {
  return <AuthenticationFixture route="/select-institution" />
}
