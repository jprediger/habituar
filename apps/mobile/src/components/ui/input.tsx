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
  // Campo só leitura precisa parecer só leitura: igual ao editável, a pessoa tenta digitar.
  const isReadOnly = props.editable === false
  const { colors, minimumTouchTarget, fontSize, fontFamily, radius } = useThemeTokens()

  return (
    <TextInput
      placeholderTextColor={colors.textPlaceholder}
      {...props}
      style={[
        {
          minHeight: minimumTouchTarget,
          borderWidth: 1,
          // A borda é reforço visual da mensagem de erro, nunca o único sinal dela.
          borderColor: hasError ? colors.danger : colors.border,
          borderRadius: radius.field,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.sm,
          fontSize: fontSize.body,
          fontFamily: fontFamily.regular,
          color: isReadOnly ? colors.textMuted : colors.text,
          backgroundColor: isReadOnly ? colors.surfaceMuted : colors.surface,
        },
        style,
      ]}
    />
  )
}
