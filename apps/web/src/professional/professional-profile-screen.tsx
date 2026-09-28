import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui/page-header.js'
import { Section } from '../components/ui/section.js'
import { SummaryCards } from '../components/ui/summary-cards.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { SignOutButton } from '../session/sign-out-button.js'

/**
 * Perfil do profissional: dados da conta, vínculo em uso e o encerramento da sessão. Não
 * edita cadastro — isso não tem contrato de API ainda.
 */
export function ProfessionalProfileScreen(): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()

  return (
    <div className="flex flex-col gap-xxl">
      <PageHeader
        eyebrow={t('professional.profile.eyebrow')}
        title={t('navigation.profile')}
        description={t('professional.profile.description')}
      />

      <Section title={t('professional.profile.accountTitle')}>
        <SummaryCards
          items={[
            { label: t('professional.profile.nameLabel'), value: session.user.name },
            { label: t('professional.profile.emailLabel'), value: session.user.email },
          ]}
        />
      </Section>

      <Section title={t('professional.profile.membershipTitle')}>
        <SummaryCards
          items={[
            { label: t('home.institutionLabel'), value: session.membership.institution.name },
            { label: t('home.roleLabel'), value: session.membership.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(", ") },
          ]}
        />
      </Section>

      <Section title={t('professional.profile.sessionTitle')} description={t('professional.profile.sessionDescription')}>
        <div>
          <SignOutButton />
        </div>
      </Section>
    </div>
  )
}
