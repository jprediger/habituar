import { assertNever } from '@habituar/core/assert-never'
import type { ManagementSection, StaffManagementContext } from '@habituar/react-client/staff-management'
import { getMembershipCapabilities, listManagementSections } from '@habituar/react-client/staff-management'
import { Link, Navigate } from '@tanstack/react-router'
import type { PropsWithChildren, ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui/page-header.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { InvitationsPanel } from './invitations-panel.js'
import { RolesPanel } from './roles-panel.js'
import { TeamPanel } from './team-panel.js'

const SECTION_PATHS = {
  team: '/professional/management/team',
  invitations: '/professional/management/invitations',
  roles: '/professional/management/roles',
} as const satisfies Readonly<Record<ManagementSection, string>>

/** Contexto de gestão da sessão institucional aprovada: a instituição e as concessões atuais. */
function useInstitutionStaffContext(): StaffManagementContext {
  const session = useInstitutionSession()
  return { kind: 'institution', institutionId: session.membership.institution.id, permissions: session.membership.permissions }
}

/**
 * Casca da Gestão no ambiente profissional: título, navegação entre as seções permitidas
 * e o guard de URL direta. Quem não pode ler a equipe volta ao Início, mesmo digitando o
 * endereço; o servidor continua sendo a barreira real.
 */
export function InstitutionManagementLayout({ children }: PropsWithChildren): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const sections = listManagementSections(getMembershipCapabilities(session.membership.permissions))

  if (sections.length === 0) return <Navigate to="/professional" replace />

  return (
    <div className="flex flex-col gap-xxl">
      <PageHeader eyebrow={session.membership.institution.name} title={t('staff.title')} description={t('staff.description')} />
      <nav aria-label={t('staff.sectionsLabel')}>
        <ul className="flex flex-wrap gap-sm">
          {sections.map((section) => (
            <li key={section}>
              <Link
                to={SECTION_PATHS[section]}
                className={
                  'inline-flex min-h-button tap-area items-center rounded-button border border-border px-md text-body font-medium ' +
                  'outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ' +
                  'aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-on-primary'
                }
              >
                {t(`staff.sections.${section}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Trocar de instituição remonta a seção: filtros, diálogos e rascunhos são daquela instituição. */}
      <div key={session.membership.institution.id}>{children}</div>
    </div>
  )
}

/** Primeira seção permitida, destino de quem abre a Gestão sem escolher seção. */
export function ManagementIndexRedirect(): ReactElement {
  const session = useInstitutionSession()
  const [first] = listManagementSections(getMembershipCapabilities(session.membership.permissions))
  return <Navigate to={first === undefined ? '/professional' : SECTION_PATHS[first]} replace />
}

/**
 * Uma seção da Gestão, protegida por si mesma: a URL direta de uma seção que a pessoa não
 * pode abrir leva ao Início em vez de montar a tela.
 */
export function ManagementSectionScreen({ section }: Readonly<{ section: ManagementSection }>): ReactElement {
  const session = useInstitutionSession()
  const context = useInstitutionStaffContext()
  const sections = listManagementSections(getMembershipCapabilities(session.membership.permissions))

  if (!sections.includes(section)) return <Navigate to="/professional" replace />

  switch (section) {
    case 'team':
      return <TeamPanel context={context} institutionName={session.membership.institution.name} />
    case 'invitations':
      return <InvitationsPanel context={context} />
    case 'roles':
      return <RolesPanel context={context} />
    default:
      return assertNever(section)
  }
}
