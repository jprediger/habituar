import { assertNever } from '@habituar/core/assert-never'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { ViewStyle } from 'react-native'
import { Pressable } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import type { TextTone } from './text'
import { Text } from './text'
import type { IconName } from './icon'
import { Icon } from './icon'

// `danger` executa a ação destrutiva (é o botão da confirmação); `dangerOutline` só a pede,
// e por isso fica mais leve que ela na tela.
export type ButtonVariant = 'primary' | 'danger' | 'dangerOutline' | 'outline' | 'link'
export type ButtonSize = 'default' | 'inline' | 'inlineBody'


const ICON_SIZE = { default: 20, inline: 16, inlineBody: 16 } as const

export type ButtonProps = Readonly<{
  label: string
  onPress: () => void
  icon?: IconName
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
  const { colors, minimumTouchTarget, compactTouchTarget, buttonHeight, radius } = useThemeTokens()
  // Completa a área de toque até o alvo padrão sem aumentar o desenho do botão.
  const verticalHitSlop = (minimumTouchTarget - buttonHeight) / 2

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: isBusy }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={size === 'default' ? { top: verticalHitSlop, bottom: verticalHitSlop } : undefined}
      // Feedback sem animação: `prefers-reduced-motion` não é consultável
      // em todo alvo nativo, e um botão não precisa de movimento para responder ao toque.
      style={({ pressed }) => [
        {
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: SPACING.xs,
          minHeight: size === 'default' ? buttonHeight : compactTouchTarget,
          paddingHorizontal: size === 'default' ? SPACING.md : 0,
          borderRadius: radius.button,
          opacity: getOpacity(variant, isDisabled, pressed),
          ...getSurfaceStyle(variant, colors, pressed),
        },
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          {icon !== undefined && (
            // Decoração: o rótulo do botão já é o nome acessível, e repetir o ícone nele
            // faria a ação ser anunciada duas vezes.
            <Icon
              name={icon}
              size={ICON_SIZE[size]}
              color={getContentColor(variant, colors, pressed)}
            />
          )}
          <Text size={size === 'inline' ? 'caption' : 'body'} weight="medium" tone={getContentTone(variant, pressed)}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  )
}

// `dangerOutline` responde ao toque pela inversão de cor, não pela opacidade: esmaecer o
// preenchimento vermelho apagaria justamente o aviso que ele dá.
function getOpacity(variant: ButtonVariant, isDisabled: boolean, isPressed: boolean): number {
  if (isDisabled) return 0.5
  return isPressed && variant !== 'dangerOutline' ? 0.7 : 1
}

/**
 * Tom do conteúdo do botão — ícone e rótulo saem daqui juntos. Separar os dois deixaria
 * o ícone de uma variante com a cor de outra na primeira mudança de paleta.
 */
function getContentTone(variant: ButtonVariant, isPressed: boolean): TextTone {
  switch (variant) {
    case 'primary':
      return 'onPrimary'
    case 'danger':
      return 'onDanger'
    case 'dangerOutline':
      return isPressed ? 'onDanger' : 'danger'
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
  isPressed: boolean,
): string {
  switch (variant) {
    case 'primary':
      return colors.onPrimary
    case 'danger':
      return colors.onDanger
    case 'dangerOutline':
      return isPressed ? colors.onDanger : colors.danger
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
  isPressed: boolean,
): ViewStyle {
  switch (variant) {
    case 'primary':
      return { backgroundColor: colors.primary }
    case 'danger':
      return { backgroundColor: colors.danger }
    case 'dangerOutline':
      // Pressionado, ganha o preenchimento do `danger`: antecipa a confirmação que vem a
      // seguir e deixa claro, no toque, que a ação não é mais uma opção neutra.
      return { borderWidth: 1, borderColor: colors.danger, backgroundColor: isPressed ? colors.danger : colors.surface }
    case 'outline':
      return { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }
    case 'link':
      return { backgroundColor: 'transparent' }
    default:
      return assertNever(variant)
  }
}
