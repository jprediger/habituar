import { SPACING } from '@habituar/design-tokens/spacing'
import { StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { PressableRow } from './pressable-row'
import { Text } from './text'

export type Choice<Value extends string> = Readonly<{ value: Value; label: string; description?: string | undefined }>

/**
 * Escolha única numa lista vertical, para quando as opções não cabem lado a lado ou têm
 * descrição. Para o leitor de tela é um grupo de rádio com nome; o controle segmentado
 * continua sendo a escolha para duas ou três opções curtas. A marca fica à direita, como
 * o interruptor de `SwitchRow`: o texto começa sempre na mesma coluna.
 */
export function ChoiceList<Value extends string>({
  label,
  choices,
  value,
  isDisabled = false,
  isLabelVisible = true,
  inset = 0,
  onChange,
}: Readonly<{ label: string; choices: readonly Choice<Value>[]; value: Value | undefined; isDisabled?: boolean; isLabelVisible?: boolean; inset?: number; onChange: (value: Value) => void }>) {
  const { colors, radius } = useThemeTokens()

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.group, { opacity: isDisabled ? 0.5 : 1 }]}>
      {/* Oculto só na tela: o nome do grupo continua indo ao leitor de tela pelo
          `accessibilityLabel`, que é quem não vê o contexto ao redor. */}
      {isLabelVisible && <Text size="caption" weight="medium" tone="muted">{label}</Text>}
      {choices.map((choice) => {
        const isSelected = choice.value === value
        return (
          <PressableRow
            key={choice.value}
            accessibilityRole="radio"
            accessibilityLabel={choice.label}
            accessibilityHint={choice.description}
            accessibilityState={{ checked: isSelected, disabled: isDisabled }}
            disabled={isDisabled}
            onPress={() => { onChange(choice.value) }}
            inset={inset}
          >
            <View style={styles.texts}>
              <Text>{choice.label}</Text>
              {choice.description !== undefined && <Text size="caption" tone="muted">{choice.description}</Text>}
            </View>
            {/* O círculo é só forma: o estado vai para a tecnologia assistiva pelo `checked`. */}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.mark, { borderColor: isSelected ? colors.primary : colors.border, borderRadius: radius.pill }]}
            >
              {isSelected && <View style={[styles.dot, { backgroundColor: colors.primary, borderRadius: radius.pill }]} />}
            </View>
          </PressableRow>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: SPACING.xs },
  mark: { width: 22, height: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10 },
  texts: { flex: 1, gap: SPACING.none },
})
