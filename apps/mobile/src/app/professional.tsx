import { AuthenticationFixture } from './authentication-fixture'

/** Declara a rota protegida do ambiente profissional. */
export default function ProfessionalScreen() {
  return <AuthenticationFixture destination="professional-home" />
}
