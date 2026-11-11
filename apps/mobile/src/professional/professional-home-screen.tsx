import { useTranslation } from 'react-i18next'
import { ListDivider } from '../components/ui/list-divider'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import type { InstitutionSession } from '../session/session-screen'
import { ProfessionalHomeMetricsSection } from './professional-home-metrics'
import { StudentList } from './student-list'

/**
 * Início do ambiente profissional: o resumo da agenda, os alunos que a pessoa acompanha e,
 * por último, onde e em qual papel. A saída de sessão não mora aqui: é do Perfil.
 */
export function ProfessionalHomeScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const readsAppointments = session.membership.permissions.some((permission) => permission.key === 'appointment.read')

  return (
    <Page>
      <PageHeader eyebrow={t('professional.eyebrow')} title={t('professional.home.greeting', { name: session.user.name })} />

      {readsAppointments && <><ProfessionalHomeMetricsSection session={session} /><ListDivider /></>}

      <StudentList session={session} title={t('professional.home.followUpSection')} />

      <ListDivider />
      <ListSection title={t('professional.home.membershipSection')}>
        <ListRow icon="buildings" title={t('home.institutionLabel')} value={session.membership.institution.name} />
        <ListRow icon="identification-card" title={t('home.roleLabel')} value={session.membership.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(', ')} />
      </ListSection>
    </Page>
  )
}
