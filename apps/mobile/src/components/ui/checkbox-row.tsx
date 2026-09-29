import { SPACING } from '@habituar/design-tokens/spacing'
import { Pressable, StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { Text } from './text'

/**
 * Caixa de marcação com rótulo e descrição opcional, do tamanho do alvo de toque. Dona só
 * do visual e da amarração acessível; marcar ou não é decisão de quem a usa.
 */
export function CheckboxRow({
  label,
  description,
  isChecked,
  isDisabled = false,
  onChange,
}: Readonly<{ label: string; description?: string | undefined; isChecked: boolean; isDisabled?: boolean; onChange: (isChecked: boolean) => void }>) {
  const { colors, minimumTouchTarget, radius } = useThemeTokens()

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: isChecked, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => { onChange(!isChecked) }}
      style={({ pressed }) => [styles.row, { minHeight: minimumTouchTarget, opacity: isDisabled ? 0.5 : pressed ? 0.7 : 1 }]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.box, { borderColor: isChecked ? colors.primary : colors.border, backgroundColor: isChecked ? colors.primary : colors.surface, borderRadius: radius.control }]}
      >
        {isChecked && <Text size="caption" weight="bold" tone="onPrimary">{'✓'}</Text>}
      </View>
      <View style={styles.texts}>
        <Text>{label}</Text>
        {description !== undefined && <Text size="caption" tone="muted">{description}</Text>}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  box: { width: 22, height: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: SPACING.none },
})
