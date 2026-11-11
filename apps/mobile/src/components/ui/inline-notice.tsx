import { SPACING } from '@habituar/design-tokens/spacing'
import { StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { Icon } from './icon'
import { Text } from './text'

const ICON_SIZE = 20

/**
 * Aviso fixo sobre a tela inteira, antes do conteúdo que ele explica — o lugar do tooltip,
 * que o celular não tem. Recusa fundo e borda: entre cartões, um aviso com superfície seria
 * lido como mais um item. Frase curta; o que precisa de explicação longa vai para a tela
 * que a ação abre.
 */
export function InlineNotice({ message }: Readonly<{ message: string }>) {
  const { colors } = useThemeTokens()

  return (
    <View style={styles.row}>
      <Icon name="info" size={ICON_SIZE} color={colors.primary} />
      <View style={styles.copy}>
        <Text size="caption" tone="muted">{message}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Ícone no topo e não centrado: com fonte ampliada a frase quebra, e o ícone precisa
  // continuar marcando o começo dela.
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  copy: { flex: 1 },
})
