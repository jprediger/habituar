import { useTranslation } from 'react-i18next'
import { ChoiceList } from '../components/ui/choice-list'
import { ListSection } from '../components/ui/list-section'
import { useThemePreference } from './app-theme-preference'
import { THEME_PREFERENCES } from './theme-preference'

/** Preferência de aparência do aparelho, compartilhada pelos perfis de todos os ambientes. */
export function ProfileThemeSettings() {
  const { t } = useTranslation()
  const themePreference = useThemePreference()
  return (
    <ListSection title={t('professional.profile.appearanceSection')}>
      <ChoiceList
        label={t('professional.profile.themeLabel')}
        choices={THEME_PREFERENCES.map(preference => ({ value: preference, label: t(`professional.profile.theme.${preference}`) }))}
        value={themePreference.state.status === 'ready' ? themePreference.state.preference : 'system'}
        onChange={themePreference.select}
      />
    </ListSection>
  )
}
