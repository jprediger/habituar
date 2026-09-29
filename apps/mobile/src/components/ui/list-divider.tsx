import { SPACING } from '@habituar/design-tokens/spacing'
import { View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'

/**
 * Faixa que separa tópicos de uma tela de lista, de borda a borda. Assume o recuo lateral
 * de `Page` e `StackPage`: fora deles, a faixa sai da largura da tela.
 */
export function ListDivider() {
  const { colors } = useThemeTokens()
  return <View importantForAccessibility="no" style={{ height: SPACING.xs + 2, marginHorizontal: -SPACING.xl, backgroundColor: colors.surfaceMuted }} />
}
