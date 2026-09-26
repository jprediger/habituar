/**
 * Entrypoint de navegação do ambiente profissional (D4): dono de *quais* destinos o
 * ambiente oferece, em que ordem e sob qual rota. Não é dono do visual — o ícone é um nome
 * semântico que cada plataforma traduz para a própria biblioteca, e o rótulo é chave de
 * i18n que cada app resolve no próprio catálogo.
 */

export type ProfessionalNavigationId = 'home' | 'profile'

export type ProfessionalNavigationIcon = 'home' | 'user'

export type ProfessionalNavigationPath = '/professional' | '/professional/profile'

export type ProfessionalNavigationItem = Readonly<{
  id: ProfessionalNavigationId
  labelKey: `navigation.${ProfessionalNavigationId}`
  path: ProfessionalNavigationPath
  icon: ProfessionalNavigationIcon
}>

// Só entra destino com conteúdo real: aba "em breve" é ruído para quem navega por leitor
// de tela. Estudantes e Agenda entram com os módulos que as sustentam.
const PROFESSIONAL_NAVIGATION: readonly ProfessionalNavigationItem[] = [
  { id: 'home', labelKey: 'navigation.home', path: '/professional', icon: 'home' },
  { id: 'profile', labelKey: 'navigation.profile', path: '/professional/profile', icon: 'user' },
]

/**
 * Destinos do ambiente profissional prontos para a barra inferior (mobile) e a sidebar
 * (web). Ponto único onde a filtragem por permissão vai entrar quando o monitor passar a
 * usar este ambiente.
 */
export function useProfessionalNavigation(): readonly ProfessionalNavigationItem[] {
  return PROFESSIONAL_NAVIGATION
}

/**
 * Qual destino está ativo para um caminho, pelo segmento mais específico que o contém.
 * Recusa prefixo solto: `/professionalx` não pertence ao ambiente.
 */
export function findActiveProfessionalNavigationItem(
  items: readonly ProfessionalNavigationItem[],
  pathname: string,
): ProfessionalNavigationItem | undefined {
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return items
    .filter((item) => normalizedPathname === item.path || normalizedPathname.startsWith(`${item.path}/`))
    .reduce<ProfessionalNavigationItem | undefined>(
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
export function listProfessionalBreadcrumbs(
  items: readonly ProfessionalNavigationItem[],
  pathname: string,
): readonly ProfessionalNavigationItem[] {
  const activeItem = findActiveProfessionalNavigationItem(items, pathname)

  if (activeItem === undefined) return []

  // `sort` ordena a cópia que o `filter` acabou de criar, nunca a lista recebida.
  return items
    .filter((item) => item.path === activeItem.path || activeItem.path.startsWith(`${item.path}/`))
    .sort((first, second) => first.path.length - second.path.length)
}
