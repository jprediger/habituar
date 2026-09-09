import { AuthenticationFixture } from './authentication-fixture'

/** Declara a rota protegida do ambiente de monitor. */
export default function MonitorScreen() {
  return <AuthenticationFixture destination="monitor-home" />
}
