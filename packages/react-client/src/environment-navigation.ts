/**
 * Entrypoint de navegação dos ambientes (D4): dono de *quais* destinos cada ambiente
 * oferece, em que ordem, sob qual rota e com qual capacidade. Não é dono do visual — o
 * ícone é um nome semântico que cada plataforma traduz para a própria biblioteca, e o
 * rótulo é chave de i18n que cada app resolve no próprio catálogo.
 */
import type { EffectivePermission } from '@habituar/core/auth/context'
import type { MembershipEnvironment } from '@habituar/core/roles'
import { getMembershipCapabilities } from './staff-management.js'
import type { StaffCapabilities } from './staff-management.js'

/**
 * Ambientes que têm casca de navegação: os três institucionais mais a administração
 * geral, que vive fora de `memberships` e por isso não cabe em `MembershipEnvironment`.
 * O monitor não tem destinos próprios: ele usa a casca profissional, filtrada por
 * capacidade, e o ambiente só nomeia a casca para quem a usa.
 */
export type NavigationEnvironment = MembershipEnvironment | 'admin'

export type NavigationId = 'home' | 'routine' | 'management' | 'profile' | 'institutions'

export type NavigationIcon = 'home' | 'calendar' | 'team' | 'user' | 'building'

// Caminhos por casca: quem consome uma casca só recebe as rotas dela, então a plataforma
// que não tem a rota de outra (o app não tem administração geral) não precisa declará-la.
type ShellNavigationPaths = Readonly<{
  professional: '/professional' | '/professional/management' | '/professional/profile'
  student: '/student' | '/student/routine'
  admin: '/admin/institutions'
}>

export type NavigationPath<Shell extends keyof ShellNavigationPaths = keyof ShellNavigationPaths> = ShellNavigationPaths[Shell]

export type NavigationItem<Path extends NavigationPath = NavigationPath> = Readonly<{
  id: NavigationId
  labelKey: `navigation.${NavigationId}`
  path: Path
  icon: NavigationIcon
}>

type ProfessionalItem = NavigationItem<NavigationPath<'professional'>>
type ProfessionalNavigationEntry = ProfessionalItem & Readonly<{ isAllowed: (capabilities: StaffCapabilities) => boolean }>

// Só entra destino com conteúdo real: aba "em breve" é ruído para quem navega por leitor
// de tela. Estudantes e Agenda entram com os módulos que as sustentam. Gestão fica entre
// Início e Perfil, e só aparece para quem consegue abrir alguma seção dela.
const PROFESSIONAL_NAVIGATION: readonly ProfessionalNavigationEntry[] = [
  { id: 'home', labelKey: 'navigation.home', path: '/professional', icon: 'home', isAllowed: () => true },
  { id: 'management', labelKey: 'navigation.management', path: '/professional/management', icon: 'team', isAllowed: (capabilities) => capabilities.canReadTeam },
  { id: 'profile', labelKey: 'navigation.profile', path: '/professional/profile', icon: 'user', isAllowed: () => true },
]

const ENVIRONMENT_NAVIGATION: { readonly [Shell in 'student' | 'admin']: readonly NavigationItem<NavigationPath<Shell>>[] } = {
  student: [
    { id: 'home', labelKey: 'navigation.home', path: '/student', icon: 'home' },
    { id: 'routine', labelKey: 'navigation.routine', path: '/student/routine', icon: 'calendar' },
  ],
  admin: [{ id: 'institutions', labelKey: 'navigation.institutions', path: '/admin/institutions', icon: 'building' }],
}

/** Destinos fixos dos ambientes sem filtragem por capacidade (aluno e administração geral). */
export function useEnvironmentNavigation<Shell extends 'student' | 'admin'>(environment: Shell): readonly NavigationItem<NavigationPath<Shell>>[] {
  return ENVIRONMENT_NAVIGATION[environment]
}

/**
 * Destinos da casca profissional, usada por profissionais e monitores, filtrados pelas
 * concessões atuais do vínculo. É filtro de navegação, não barreira: cada rota ainda tem
 * seu guard e o servidor ainda decide.
 */
export function useProfessionalNavigation(
  membership: Readonly<{ permissions: readonly EffectivePermission[] }>,
): readonly ProfessionalItem[] {
  const capabilities = getMembershipCapabilities(membership.permissions)
  return PROFESSIONAL_NAVIGATION.filter((entry) => entry.isAllowed(capabilities)).map(({ id, labelKey, path, icon }) => ({ id, labelKey, path, icon }))
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
