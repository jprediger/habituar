import { SPACING } from '@habituar/design-tokens/spacing'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Text } from './components/ui/text'
import { useThemeTokens } from './theme/tokens'

/**
 * O que o app mostra enquanto a sessão gravada é restaurada. Existe para que nenhum
 * estado de autenticação produza tela vazia — e anuncia a espera, em vez de só ocupá-la.
 */
export function SessionLoadingScreen() {
  const { t } = useTranslation()
  const { colors } = useThemeTokens()

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text accessibilityLiveRegion="polite" accessibilityRole="text">
        {t('authentication.loading')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
})
