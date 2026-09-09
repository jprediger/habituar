import { Redirect } from 'expo-router'

/**
 * Mantém a raiz sem conteúdo para que o guard do layout escolha a rota conceitual correta.
 */
export default function IndexScreen() {
  return <Redirect href="/login" />
}
