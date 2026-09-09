import { AuthenticationFixture } from './authentication-fixture'

/** Declara a rota protegida do ambiente de aluno. */
export default function StudentScreen() {
  return <AuthenticationFixture destination="student-home" />
}
