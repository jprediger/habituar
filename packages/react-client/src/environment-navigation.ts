/**
 * Entrypoint de navegação dos ambientes (D4): dono de *quais* destinos cada ambiente
 * oferece, em que ordem e sob qual rota. Não é dono do visual — o ícone é um nome
 * semântico que cada plataforma traduz para a própria biblioteca, e o rótulo é chave de
 * i18n que cada app resolve no próprio catálogo.
 */
import type { MembershipEnvironment } from '@habituar/core/roles'

/**
 * Ambientes que têm casca de navegação: os três institucionais mais a administração
 * geral, que vive fora de `memberships` e por isso não cabe em `MembershipEnvironment`.
 */
export type NavigationEnvironment = MembershipEnvironment | 'admin'

export type NavigationId = 'home' | 'profile' | 'institutions'

export type NavigationIcon = 'home' | 'user' | 'building'

// Caminhos por ambiente: quem consome um ambiente só recebe as rotas dele, então a
// plataforma que ainda não tem a rota de outro ambiente não precisa declará-la.
type EnvironmentNavigationPaths = Readonly<{
  professional: '/professional' | '/professional/profile'
  student: '/student'
  monitor: '/monitor'
  admin: '/admin/institutions'
}>

export type NavigationPath<Environment extends NavigationEnvironment = NavigationEnvironment> =
  EnvironmentNavigationPaths[Environment]

export type NavigationItem<Environment extends NavigationEnvironment = NavigationEnvironment> = Readonly<{
  id: NavigationId
  labelKey: `navigation.${NavigationId}`
  path: NavigationPath<Environment>
  icon: NavigationIcon
}>

// Só entra destino com conteúdo real: aba "em breve" é ruído para quem navega por leitor
// de tela. Estudantes e Agenda entram com os módulos que as sustentam.
const ENVIRONMENT_NAVIGATION: { readonly [Environment in NavigationEnvironment]: readonly NavigationItem<Environment>[] } = {
  professional: [
    { id: 'home', labelKey: 'navigation.home', path: '/professional', icon: 'home' },
    { id: 'profile', labelKey: 'navigation.profile', path: '/professional/profile', icon: 'user' },
  ],
  student: [{ id: 'home', labelKey: 'navigation.home', path: '/student', icon: 'home' }],
  monitor: [{ id: 'home', labelKey: 'navigation.home', path: '/monitor', icon: 'home' }],
  admin: [{ id: 'institutions', labelKey: 'navigation.institutions', path: '/admin/institutions', icon: 'building' }],
}

/**
 * Destinos de um ambiente prontos para a barra inferior (mobile) e a sidebar (web). Ponto
 * único onde a filtragem por permissão vai entrar.
 */
export function useEnvironmentNavigation<Environment extends NavigationEnvironment>(
  environment: Environment,
): readonly NavigationItem<Environment>[] {
  return ENVIRONMENT_NAVIGATION[environment]
}

/**
 * Qual destino está ativo para um caminho, pelo segmento mais específico que o contém.
 * Recusa prefixo solto: `/professionalx` não pertence ao ambiente.
 */
export function findActiveNavigationItem<Item extends NavigationItem>(
  items: readonly Item[],
  pathname: string,
): Item | undefined {
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return items
    .filter((item) => normalizedPathname === item.path || normalizedPathname.startsWith(`${item.path}/`))
    .reduce<Item | undefined>(
      (mostSpecific, item) =>
        mostSpecific === undefined || item.path.length > mostSpecific.path.length ? item : mostSpecific,
      undefined,
    )
}

/**
 * Trilha da raiz do ambiente até o destino ativo, para os breadcrumbs. A árvore sai dos
 * próprios caminhos — um destino é ancestral de outro quando o contém como segmento —,
 * então destino novo entra na trilha certa sem declarar pai à mão.
 */
export function listNavigationBreadcrumbs<Item extends NavigationItem>(
  items: readonly Item[],
  pathname: string,
): readonly Item[] {
  const activeItem = findActiveNavigationItem(items, pathname)

  if (activeItem === undefined) return []

  // `sort` ordena a cópia que o `filter` acabou de criar, nunca a lista recebida.
  return items
    .filter((item) => item.path === activeItem.path || activeItem.path.startsWith(`${item.path}/`))
    .sort((first, second) => first.path.length - second.path.length)
}
