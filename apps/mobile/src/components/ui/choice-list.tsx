import { SPACING } from '@habituar/design-tokens/spacing'
import { Pressable, StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { Text } from './text'

export type Choice<Value extends string> = Readonly<{ value: Value; label: string; description?: string | undefined }>

/**
 * Escolha única numa lista vertical, para quando as opções não cabem lado a lado ou têm
 * descrição. Para o leitor de tela é um grupo de rádio com nome; o controle segmentado
 * continua sendo a escolha para duas ou três opções curtas.
 */
export function ChoiceList<Value extends string>({
  label,
  choices,
  value,
  onChange,
}: Readonly<{ label: string; choices: readonly Choice<Value>[]; value: Value | undefined; onChange: (value: Value) => void }>) {
  const { colors, minimumTouchTarget, radius } = useThemeTokens()

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      <Text weight="medium">{label}</Text>
      {choices.map((choice) => {
        const isSelected = choice.value === value
        return (
          <Pressable
            key={choice.value}
            accessibilityRole="radio"
            accessibilityLabel={choice.label}
            accessibilityHint={choice.description}
            accessibilityState={{ checked: isSelected }}
            onPress={() => { onChange(choice.value) }}
            style={({ pressed }) => [styles.row, { minHeight: minimumTouchTarget, opacity: pressed ? 0.7 : 1 }]}
          >
            {/* O círculo é só forma: o estado vai para a tecnologia assistiva pelo `checked`. */}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.mark, { borderColor: isSelected ? colors.primary : colors.border, borderRadius: radius.pill }]}
            >
              {isSelected && <View style={[styles.dot, { backgroundColor: colors.primary, borderRadius: radius.pill }]} />}
            </View>
            <View style={styles.texts}>
              <Text>{choice.label}</Text>
              {choice.description !== undefined && <Text size="caption" tone="muted">{choice.description}</Text>}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: SPACING.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  mark: { width: 22, height: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10 },
  texts: { flex: 1, gap: SPACING.none },
})
