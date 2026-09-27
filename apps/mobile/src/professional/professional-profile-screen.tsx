import { useTranslation } from 'react-i18next'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { SegmentedControl } from '../components/ui/segmented-control'
import { Section } from '../components/ui/section'
import { SummaryCard } from '../components/ui/summary-card'
import type { InstitutionSession } from '../session/session-screen'
import { SignOutButton } from '../session/sign-out-button'
import { useThemePreference } from '../theme/app-theme-preference'
import { THEME_PREFERENCES } from '../theme/theme-preference'

/**
 * Perfil do profissional: a conta, o vínculo ativo, a aparência e a saída da sessão. Não oferece
 * troca de instituição — a sessão autenticada não guarda os outros vínculos, e a única
 * escolha que existe hoje acontece antes de entrar.
 */
export function ProfessionalProfileScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const themePreference = useThemePreference()

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

      <Section title={t('professional.profile.appearanceSection')}>
        <SegmentedControl
          label={t('professional.profile.themeLabel')}
          options={THEME_PREFERENCES.map((preference) => ({
            value: preference,
            label: t(`professional.profile.theme.${preference}`),
          }))}
          // A tela só monta depois de a raiz esperar a preferência; `loading` aqui seria
          // leitura antes da hora, e o sistema é o que o app já está mostrando nesse caso.
          value={themePreference.state.status === 'ready' ? themePreference.state.preference : 'system'}
          onChange={themePreference.select}
        />
      </Section>

      <SignOutButton />
    </Page>
  )
}
