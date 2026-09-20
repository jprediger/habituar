import { SPACING } from '@habituar/design-tokens/spacing'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import type { InputProps } from './input'
import { Input } from './input'

export type PasswordInputProps = Omit<InputProps, 'secureTextEntry'>

/**
 * Campo de senha com alternância de visibilidade. Dono apenas de mostrar ou esconder o
 * que foi digitado — nunca guarda, transforma ou valida a senha.
 */
export function PasswordInput({ style, ...props }: PasswordInputProps) {
  const { t } = useTranslation()
  const { colors, minimumTouchTarget, fontSize } = useThemeTokens()
  const [isVisible, setIsVisible] = useState(false)

  const label = isVisible ? t('form.password.hide') : t('form.password.show')

  return (
    <View style={styles.row}>
      {/* O mesmo `TextInput` atravessa a alternância: remontá-lo apaga o conteúdo em
          parte dos Androids. */}
      <Input
        {...props}
        secureTextEntry={!isVisible}
        style={[styles.field, { paddingRight: minimumTouchTarget }, style]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        // O RN não tem equivalente de `aria-pressed`; `selected` é o estado que o
        // TalkBack e o VoiceOver anunciam para um controle que fica ligado.
        accessibilityState={{ selected: isVisible }}
        onPress={() => {
          setIsVisible(!isVisible)
        }}
        style={{
          position: 'absolute',
          right: 0,
          minHeight: minimumTouchTarget,
          minWidth: minimumTouchTarget,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ color: colors.textMuted, fontSize: fontSize.body }}
        >
          {isVisible ? '🙈' : '👁'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  field: { flex: 1, paddingRight: SPACING.xl },
})
