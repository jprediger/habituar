import { useTranslation } from 'react-i18next'
import { Pressable, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { habituar } from '../habituar-client'

export default function SelectInstitutionRoute() {
  const { t } = useTranslation()
  const { state, actions } = habituar.useAuthentication()

  if (state.status !== 'selecting-membership') return null

  return (
    <SafeAreaView>
      <Text accessibilityRole="header">{t('authentication.selectInstitution')}</Text>
      {state.memberships.map((membership) => (
        <Pressable
          key={membership.institution.id}
          accessibilityRole="button"
          onPress={() => void actions.selectMembership(membership.institution.id)}
        >
          <Text>{membership.institution.name}</Text>
        </Pressable>
      ))}
    </SafeAreaView>
  )
}