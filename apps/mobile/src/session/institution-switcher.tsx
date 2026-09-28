import { useState } from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { Text } from '../components/ui/text'

/** Apresenta os vínculos autorizados; o hook compartilhado resolve a troca. */
export function InstitutionSwitcher() {
  const { t } = useTranslation()
  const { current, others, switchTo } = habituar.useInstitutionSwitcher()
  const [isExpanded, setIsExpanded] = useState(false)
  if (current === undefined || others.length === 0) return null
  return <View>
    <Text accessibilityLiveRegion="polite">{t('institutionSwitcher.current', { institution: current.institution.name })}</Text>
    <Button variant="outline" label={t('institutionSwitcher.change')} onPress={() => { setIsExpanded(!isExpanded) }} />
    {isExpanded && others.map((membership) => <Button key={membership.institution.id} variant="outline" label={membership.institution.name} onPress={() => { void switchTo(membership.institution.id); setIsExpanded(false) }} />)}
  </View>
}
