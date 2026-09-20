import { SPACING } from '@habituar/design-tokens/spacing'
import type { MembershipContext } from '@habituar/react-client/react-client'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { AuthenticationCard } from './authentication-card'
import { Button } from './components/ui/button'
import { habituar } from './habituar-client'
import { useThemeTokens } from './theme/tokens'

/** Escolha do vínculo ativo quando a conta tem mais de um; não decide destino algum. */
export function InstitutionSelectionScreen({
  memberships,
}: Readonly<{ memberships: readonly MembershipContext[] }>) {
  const { t } = useTranslation()
  const { colors, fontSize } = useThemeTokens()
  const { actions } = habituar.useAuthentication()

  return (
    <AuthenticationCard
      heading={t('authentication.selection.title')}
      description={t('authentication.selection.description')}
    >
      {memberships.map((membership) => (
        <View key={membership.institution.id} style={styles.option}>
          <Button
            variant="outline"
            label={membership.institution.name}
            onPress={() => {
              void actions.selectMembership(membership.institution.id)
            }}
          />
          <Text style={{ color: colors.textMuted, fontSize: fontSize.caption, textAlign: 'center' }}>
            {membership.role.name}
          </Text>
        </View>
      ))}
    </AuthenticationCard>
  )
}

const styles = StyleSheet.create({
  option: { gap: SPACING.xs },
})
