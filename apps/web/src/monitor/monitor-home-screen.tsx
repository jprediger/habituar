import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui/page-header.js'
import { Section } from '../components/ui/section.js'
import { SummaryCards } from '../components/ui/summary-cards.js'
import { useInstitutionSession } from '../session/institution-session.js'

/**
 * Início do monitor dentro da casca profissional. Mostra só o vínculo; os destinos que o
 * monitor alcança vêm das concessões dele, na navegação, e não desta tela.
 */
export function MonitorHomeScreen(): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()

  return (
    <div className="flex flex-col gap-xxl">
      <PageHeader
        eyebrow={t('navigation.home')}
        title={t('home.monitor-home.title')}
        description={t('home.monitor-home.description')}
      />

      <Section title={t('home.membershipTitle')}>
        <SummaryCards
          items={[
            { label: t('home.institutionLabel'), value: session.membership.institution.name },
            { label: t('home.roleLabel'), value: session.membership.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(', ') },
          ]}
        />
      </Section>
    </div>
  )
}
