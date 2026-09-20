import { SPACING } from '@habituar/design-tokens/spacing'
import type { Ref } from 'react'
import type { TextInputProps } from 'react-native'
import { TextInput } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'

export type InputProps = TextInputProps & Readonly<{ hasError?: boolean; ref?: Ref<TextInput> }>

/**
 * Único campo de texto do kit nativo; dono da aparência, do alvo de toque e da borda de
 * erro — rótulo, validação e mensagem continuam sendo do chamador.
 */
export function Input({ hasError = false, style, ...props }: InputProps) {
  const { colors, minimumTouchTarget, fontSize } = useThemeTokens()

  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[
        {
          minHeight: minimumTouchTarget,
          borderWidth: 1,
          // A borda é reforço visual da mensagem de erro, nunca o único sinal dela.
          borderColor: hasError ? colors.danger : colors.border,
          borderRadius: SPACING.sm,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.sm,
          fontSize: fontSize.body,
          color: colors.text,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    />
  )
}
