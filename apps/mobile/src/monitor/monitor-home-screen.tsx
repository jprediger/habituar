import { useTranslation } from 'react-i18next'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { Section } from '../components/ui/section'
import { SummaryCard } from '../components/ui/summary-card'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'

/**
 * Início do monitor dentro da casca profissional. Mostra só o vínculo; os destinos que o
 * monitor alcança vêm das concessões dele, na barra de abas, e a saída de sessão é do Perfil.
 */
export function MonitorHomeScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()

  return (
    <Page>
      <PageHeader eyebrow={t('navigation.home')} title={t('home.monitor-home.title')} />
      <Text tone="muted">{t('home.monitor-home.description')}</Text>
      <Section title={t('professional.home.membershipSection')}>
        <SummaryCard
          items={[
            { label: t('home.institutionLabel'), value: session.membership.institution.name },
            { label: t('home.roleLabel'), value: session.membership.roles.map((role) => (role.templateKey === null ? role.name : t(`roles.${role.templateKey}`))).join(', ') },
          ]}
        />
      </Section>
    </Page>
  )
}
