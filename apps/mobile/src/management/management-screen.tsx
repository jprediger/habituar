import { getMembershipCapabilities, listManagementSections } from '@habituar/react-client/staff-management'
import type { ManagementSection } from '@habituar/react-client/staff-management'
import { assertNever } from '@habituar/core/assert-never'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { IconName } from '../components/ui/icon'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import type { InstitutionSession } from '../session/session-screen'

/**
 * Aba Gestão: lista das seções que a pessoa pode abrir. Cada seção é uma tela própria na
 * pilha, como os detalhes de membro, convite e papel.
 */
export function ManagementScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const sections = listManagementSections(getMembershipCapabilities(session.membership.permissions))

  return (
    <Page>
      <PageHeader eyebrow={session.membership.institution.name} title={t('staff.title')} />
      <ListSection title={t('staff.sectionsLabel')}>
        {sections.map((section) => (
          <ListRow
            key={section}
            icon={getSectionIcon(section)}
            title={t(`staff.sections.${section}`)}
            description={t(`staff.sectionDescriptions.${section}`)}
            onPress={() => { router.push(`/professional/management/${section}`) }}
          />
        ))}
      </ListSection>
    </Page>
  )
}

function getSectionIcon(section: ManagementSection): IconName {
  switch (section) {
    case 'team':
      return 'users-three'
    case 'invitations':
      return 'envelope-simple'
    case 'roles':
      return 'shield-check'
    default:
      return assertNever(section)
  }
}
