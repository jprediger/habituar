import { useTranslation } from 'react-i18next'
import { EmptyState } from './components/ui/empty-state'
import { Page } from './components/ui/page'
import { PageHeader } from './components/ui/page-header'
import { Section } from './components/ui/section'
import { SummaryCard } from './components/ui/summary-card'
import type { InstitutionSession } from './session-screen'

/**
 * Início do ambiente profissional. Mostra só o que a sessão já sabe — quem é, onde e
 * em qual papel — e reserva o lugar do acompanhamento sem preenchê-lo com exemplo. A
 * saída de sessão não mora aqui: é do Perfil.
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
            { label: t('home.roleLabel'), value: session.membership.role.name },
          ]}
        />
      </Section>

      <Section title={t('professional.home.followUpSection')}>
        <EmptyState title={t('professional.home.emptyTitle')} description={t('professional.home.emptyDescription')} />
      </Section>
    </Page>
  )
}
