import { useTranslation } from 'react-i18next'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { ChoiceList } from '../components/ui/choice-list'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import type { InstitutionSession } from '../session/session-screen'
import { SignOutButton } from '../session/sign-out-button'
import { InstitutionSwitcher } from '../session/institution-switcher'
import { useThemePreference } from '../theme/app-theme-preference'
import { THEME_PREFERENCES } from '../theme/theme-preference'

/**
 * Perfil do profissional: a conta, o vínculo ativo, a aparência e a saída da sessão. Não oferece
 * alterações nos dados da conta; a troca de vínculo pertence ao hook de sessão.
 */
export function ProfessionalProfileScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const themePreference = useThemePreference()

  return (
    <Page>
      <PageHeader eyebrow={t('professional.eyebrow')} title={t('navigation.profile')} />

      <ListSection title={t('professional.profile.accountSection')}>
        <ListRow icon="user" title={session.user.name} description={t('professional.profile.nameLabel')} />
        <ListRow icon="envelope-simple" title={session.user.email} description={t('professional.profile.emailLabel')} />
      </ListSection>

      <ListSection title={t('professional.profile.institutionSection')}>
        <ListRow icon="buildings" title={session.membership.institution.name} description={t('home.institutionLabel')} />
        <ListRow
          icon="identification-card"
          title={session.membership.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(', ')}
          description={t('home.roleLabel')}
        />
        <InstitutionSwitcher />
      </ListSection>

      <ListSection title={t('professional.profile.appearanceSection')}>
        <ChoiceList
          label={t('professional.profile.themeLabel')}
          choices={THEME_PREFERENCES.map((preference) => ({
            value: preference,
            label: t(`professional.profile.theme.${preference}`),
          }))}
          // A tela só monta depois de a raiz esperar a preferência; `loading` aqui seria
          // leitura antes da hora, e o sistema é o que o app já está mostrando nesse caso.
          value={themePreference.state.status === 'ready' ? themePreference.state.preference : 'system'}
          onChange={themePreference.select}
        />
      </ListSection>

      <SignOutButton />
    </Page>
  )
}
