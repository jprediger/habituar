import { SPACING } from '@habituar/design-tokens/spacing'
import { StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { Text } from './text'

export type SummaryItem = Readonly<{ label: string; value: string }>

/**
 * Resumo de fatos em pares rótulo/valor, numa superfície de borda fina. Só mostra o que
 * recebe: não calcula, não formata e não inventa valor para linha vazia.
 */
export function SummaryCard({ items }: Readonly<{ items: readonly SummaryItem[] }>) {
  const { colors, radius } = useThemeTokens()

  return (
    <View
      style={[styles.card, { borderColor: colors.border, borderRadius: radius.surface, backgroundColor: colors.surface }]}
    >
      {items.map((item, index) => (
        <View
          key={item.label}
          // Rótulo sobre valor, não lado a lado: com fonte ampliada, duas colunas
          // estreitas quebram palavra no meio; empilhado, cada texto tem a largura toda.
          style={[
            styles.row,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
          ]}
        >
          <Text size="caption" tone="muted">
            {item.label}
          </Text>
          <Text weight="medium">{item.value}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  // Borda fina em vez de sombra: a separação vem do traço, e o traço não muda de peso
  // entre claro e escuro como uma sombra muda.
  card: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACING.lg },
  row: { gap: SPACING.xs, paddingVertical: SPACING.md },
})
