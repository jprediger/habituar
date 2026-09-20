import { SPACING } from '@habituar/design-tokens/spacing'
import { assertNever } from '@habituar/core/assert-never'
import type { ViewStyle } from 'react-native'
import { Pressable, Text } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'

export type ButtonVariant = 'primary' | 'outline' | 'link'
export type ButtonSize = 'default' | 'inline'

export type ButtonProps = Readonly<{
  label: string
  onPress: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  isDisabled?: boolean
  isBusy?: boolean
  style?: ViewStyle
}>

/**
 * Único botão do kit nativo; dono só da aparência interativa e do alvo de toque — o texto
 * vem de i18n e a decisão de quando ele aparece é do chamador.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  isDisabled = false,
  isBusy = false,
  style,
}: ButtonProps) {
  const { colors, minimumTouchTarget, compactTouchTarget, fontSize, fontWeight } = useThemeTokens()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: isBusy }}
      disabled={isDisabled}
      onPress={onPress}
      // Feedback por opacidade, sem animação: `prefers-reduced-motion` não é consultável
      // em todo alvo nativo, e um botão não precisa de movimento para responder ao toque.
      style={({ pressed }) => [
        {
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: SPACING.xs,
          minHeight: size === 'default' ? minimumTouchTarget : compactTouchTarget,
          paddingHorizontal: size === 'default' ? SPACING.lg : 0,
          borderRadius: SPACING.sm,
          opacity: isDisabled ? 0.5 : pressed ? 0.7 : 1,
          ...getSurfaceStyle(variant, colors),
        },
        style,
      ]}
    >
      <Text
        style={{
          color: variant === 'primary' ? colors.onPrimary : variant === 'link' ? colors.primary : colors.text,
          fontSize: size === 'default' ? fontSize.body : fontSize.caption,
          fontWeight: fontWeight.medium,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function getSurfaceStyle(
  variant: ButtonVariant,
  colors: ReturnType<typeof useThemeTokens>['colors'],
): ViewStyle {
  switch (variant) {
    case 'primary':
      return { backgroundColor: colors.primary }
    case 'outline':
      return { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }
    case 'link':
      return { backgroundColor: 'transparent' }
    default:
      return assertNever(variant)
  }
}
