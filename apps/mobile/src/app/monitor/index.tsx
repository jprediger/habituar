import { Redirect } from 'expo-router'

/**
 * Endereço antigo do ambiente do monitor, mantido só para redirecionar: o monitor usa o
 * ambiente profissional. A instituição ativa vive na sessão, então segue a mesma.
 */
export default function MonitorRedirectRoute() {
  return <Redirect href="/professional" />
}
