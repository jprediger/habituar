import Ionicons from '@expo/vector-icons/Ionicons'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import type { InputProps } from './input'
import { Input } from './input'

const ICON_SIZE = 20

export type PasswordInputProps = Omit<InputProps, 'secureTextEntry'>

/**
 * Campo de senha com alternância de visibilidade. Dono apenas de mostrar ou esconder o
 * que foi digitado — nunca guarda, transforma ou valida a senha.
 */
export function PasswordInput({ style, ...props }: PasswordInputProps) {
  const { t } = useTranslation()
  const { colors, minimumTouchTarget } = useThemeTokens()
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
        {/* O ícone é decoração: o rótulo do botão já diz o que o toque faz. */}
        <Ionicons
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          name={isVisible ? 'eye-off-outline' : 'eye-outline'}
          size={ICON_SIZE}
          color={colors.textMuted}
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  field: { flex: 1, paddingRight: SPACING.xl },
})
