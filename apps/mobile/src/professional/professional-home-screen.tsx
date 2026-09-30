import { useTranslation } from 'react-i18next'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { Section } from '../components/ui/section'
import { SummaryCard } from '../components/ui/summary-card'
import type { InstitutionSession } from '../session/session-screen'
import { StudentList } from './student-list'

/**
 * Início do ambiente profissional: quem é, onde, em qual papel, e os alunos que a pessoa
 * acompanha. A saída de sessão não mora aqui: é do Perfil.
 */
export function ProfessionalHomeScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()

  return (
    <Page>
      <PageHeader eyebrow={t('professional.eyebrow')} title={t('professional.home.greeting', { name: session.user.name })} />

      <Section title={t('professional.home.membershipSection')}>
        <SummaryCard
          items={[
            { label: t('home.institutionLabel'), value: session.membership.institution.name },
            { label: t('home.roleLabel'), value: session.membership.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(", ") },
          ]}
        />
      </Section>

      <StudentList session={session} title={t('professional.home.followUpSection')} />
    </Page>
  )
}
