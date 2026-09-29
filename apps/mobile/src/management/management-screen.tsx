import { getMembershipCapabilities, listManagementSections } from '@habituar/react-client/staff-management'
import type { ManagementSection } from '@habituar/react-client/staff-management'
import { assertNever } from '@habituar/core/assert-never'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { SegmentedControl } from '../components/ui/segmented-control'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { InvitationsSection } from './invitations-section'
import { RolesSection } from './roles-section'
import { toStaffContext } from './staff-context'
import { TeamSection } from './team-section'

/**
 * Aba Gestão: as seções que a pessoa pode abrir, uma por vez, escolhidas no controle
 * segmentado. Detalhes (membro, convite, papel) abrem como telas próprias na pilha.
 */
export function ManagementScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const sections = listManagementSections(getMembershipCapabilities(session.membership.permissions))
  const [chosen, setChosen] = useState<ManagementSection>('team')
  const section = sections.includes(chosen) ? chosen : sections[0] ?? 'team'

  return (
    <Page>
      <PageHeader eyebrow={session.membership.institution.name} title={t('staff.title')} />
      <Text tone="muted">{t('staff.description')}</Text>
      <SegmentedControl
        label={t('staff.sectionsLabel')}
        options={sections.map((value) => ({ value, label: t(`staff.sections.${value}`) }))}
        value={section}
        onChange={setChosen}
      />
      <ManagementSectionContent section={section} session={session} />
    </Page>
  )
}

function ManagementSectionContent({ section, session }: Readonly<{ section: ManagementSection; session: InstitutionSession }>) {
  const context = toStaffContext(session)
  switch (section) {
    case 'team':
      return <TeamSection context={context} />
    case 'invitations':
      return <InvitationsSection context={context} />
    case 'roles':
      return <RolesSection context={context} />
    default:
      return assertNever(section)
  }
}
