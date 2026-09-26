import { useTranslation } from 'react-i18next'
import { Page } from './components/ui/page'
import { PageHeader } from './components/ui/page-header'
import { Section } from './components/ui/section'
import { SummaryCard } from './components/ui/summary-card'
import type { InstitutionSession } from './session-screen'
import { SignOutButton } from './sign-out-button'

/**
 * Perfil do profissional: a conta, o vínculo ativo e a saída da sessão. Não oferece
 * troca de instituição — a sessão autenticada não guarda os outros vínculos, e a única
 * escolha que existe hoje acontece antes de entrar.
 */
export function ProfessionalProfileScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()

  return (
    <Page>
      <PageHeader eyebrow={t('professional.eyebrow')} title={t('navigation.profile')} />

      <Section title={t('professional.profile.accountSection')}>
        <SummaryCard
          items={[
            { label: t('professional.profile.nameLabel'), value: session.user.name },
            { label: t('professional.profile.emailLabel'), value: session.user.email },
          ]}
        />
      </Section>

      <Section title={t('professional.profile.institutionSection')}>
        <SummaryCard
          items={[
            { label: t('home.institutionLabel'), value: session.membership.institution.name },
            { label: t('home.roleLabel'), value: session.membership.role.name },
          ]}
        />
      </Section>

      <SignOutButton />
    </Page>
  )
}
