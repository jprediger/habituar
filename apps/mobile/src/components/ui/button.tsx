import Ionicons from '@expo/vector-icons/Ionicons'
import { assertNever } from '@habituar/core/assert-never'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { ComponentProps } from 'react'
import type { ViewStyle } from 'react-native'
import { Pressable } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import type { TextTone } from './text'
import { Text } from './text'

export type ButtonVariant = 'primary' | 'outline' | 'link'
export type ButtonSize = 'default' | 'inline'

/** Nome de ícone do conjunto já embarcado pelo Expo; não se inventa glifo fora dele. */
export type ButtonIcon = ComponentProps<typeof Ionicons>['name']

const ICON_SIZE = { default: 20, inline: 16 } as const

export type ButtonProps = Readonly<{
  label: string
  onPress: () => void
  icon?: ButtonIcon
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
  icon,
  variant = 'primary',
  size = 'default',
  isDisabled = false,
  isBusy = false,
  style,
}: ButtonProps) {
  const { colors, minimumTouchTarget, compactTouchTarget, radius } = useThemeTokens()
  const contentColor = getContentColor(variant, colors)

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
          borderRadius: radius.pill,
          opacity: isDisabled ? 0.5 : pressed ? 0.7 : 1,
          ...getSurfaceStyle(variant, colors),
        },
        style,
      ]}
    >
      {icon !== undefined && (
        // Decoração: o rótulo do botão já é o nome acessível, e repetir o ícone nele
        // faria a ação ser anunciada duas vezes.
        <Ionicons
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          name={icon}
          size={ICON_SIZE[size]}
          color={contentColor}
        />
      )}
      <Text size={size === 'default' ? 'body' : 'caption'} weight="medium" tone={getContentTone(variant)}>
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * Tom do conteúdo do botão — ícone e rótulo saem daqui juntos. Separar os dois deixaria
 * o ícone de uma variante com a cor de outra na primeira mudança de paleta.
 */
function getContentTone(variant: ButtonVariant): TextTone {
  switch (variant) {
    case 'primary':
      return 'onPrimary'
    case 'outline':
      return 'default'
    case 'link':
      return 'primary'
    default:
      return assertNever(variant)
  }
}

function getContentColor(
  variant: ButtonVariant,
  colors: ReturnType<typeof useThemeTokens>['colors'],
): string {
  switch (variant) {
    case 'primary':
      return colors.onPrimary
    case 'outline':
      return colors.text
    case 'link':
      return colors.primary
    default:
      return assertNever(variant)
  }
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
