import { SPACING } from '@habituar/design-tokens/spacing'
import { StyleSheet, TextInput, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { Icon } from './icon'

/**
 * Campo de busca das listagens, sempre o primeiro elemento da tela. Busca ao enviar pelo
 * teclado; o rótulo acessível substitui o rótulo visível que um campo comum teria.
 */
export function SearchField({ label, value, onChangeText, onSubmit }: Readonly<{ label: string; value: string; onChangeText: (value: string) => void; onSubmit: () => void }>) {
  const { colors, minimumTouchTarget, fontSize, fontFamily, radius } = useThemeTokens()

  return (
    <View style={[styles.container, { minHeight: minimumTouchTarget, borderRadius: radius.field, backgroundColor: colors.surfaceMuted }]}>
      <Icon name="magnifying-glass" size={20} color={colors.textMuted} />
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={colors.textPlaceholder}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { fontSize: fontSize.body, fontFamily: fontFamily.regular, color: colors.text }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md },
  input: { flex: 1, paddingVertical: SPACING.sm },
})
