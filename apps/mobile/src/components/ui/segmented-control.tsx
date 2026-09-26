import { SPACING } from '@habituar/design-tokens/spacing'
import { Pressable, StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { Text } from './text'

export type SegmentedOption<Value extends string> = Readonly<{ value: Value; label: string }>

/**
 * Escolha única entre poucas opções mutuamente exclusivas, todas visíveis ao mesmo tempo.
 * Para o leitor de tela é um grupo de rádio: o nome do grupo diz o que se escolhe, e cada
 * opção anuncia se está marcada. Não serve para liga/desliga — isso é um switch.
 */
export function SegmentedControl<Value extends string>({
  label,
  options,
  value,
  onChange,
}: Readonly<{
  label: string
  options: readonly SegmentedOption<Value>[]
  value: Value
  onChange: (value: Value) => void
}>) {
  const { colors, radius, minimumTouchTarget } = useThemeTokens()

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[
        styles.group,
        { borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface },
      ]}
    >
      {options.map((option) => {
        const isSelected = option.value === value

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: isSelected }}
            onPress={() => {
              onChange(option.value)
            }}
            style={({ pressed }) => [
              styles.option,
              {
                minHeight: minimumTouchTarget,
                borderRadius: radius.pill,
                backgroundColor: isSelected ? colors.primary : 'transparent',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text size="caption" weight={isSelected ? 'bold' : 'regular'} tone={isSelected ? 'onPrimary' : 'muted'}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, padding: SPACING.xs },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.sm },
})
