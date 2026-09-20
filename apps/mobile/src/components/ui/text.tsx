import type { TextProps as NativeTextProps } from 'react-native'
import { Text as NativeText } from 'react-native'
import type { FontWeightRole } from '../../theme/tokens'
import { useThemeTokens } from '../../theme/tokens'

export type TextSize = 'caption' | 'body' | 'title' | 'display'
export type TextTone = 'default' | 'muted' | 'danger' | 'primary' | 'onPrimary'

export type TextProps = Omit<NativeTextProps, 'style'> &
  Readonly<{
    size?: TextSize
    weight?: FontWeightRole
    tone?: TextTone
    isCentered?: boolean
  }>

/**
 * Único texto do app. Existe porque a família da fonte não pode ser decidida por tela:
 * um `Text` do React Native que esqueça `fontFamily` cai na fonte do sistema e continua
 * passando em todo teste, então a única defesa é não haver onde esquecer.
 *
 * Tamanho, peso e tom vêm por papel, nunca por valor — quem chama não escolhe pixel.
 */
export function Text({
  size = 'body',
  weight = 'regular',
  tone = 'default',
  isCentered = false,
  ...props
}: TextProps) {
  const { colors, fontSize, fontFamily, lineHeight } = useThemeTokens()

  return (
    <NativeText
      {...props}
      style={{
        color: getToneColor(tone, colors),
        fontSize: fontSize[size],
        fontFamily: fontFamily[weight],
        // Título respira menos que corpo: entrelinha de leitura numa frase curta e
        // grande abre um buraco no meio da tela.
        lineHeight: size === 'display' || size === 'title' ? lineHeight[size].tight : lineHeight[size].normal,
        textAlign: isCentered ? 'center' : undefined,
      }}
    />
  )
}

function getToneColor(tone: TextTone, colors: ReturnType<typeof useThemeTokens>['colors']): string {
  switch (tone) {
    case 'default':
      return colors.text
    case 'muted':
      return colors.textMuted
    case 'danger':
      return colors.danger
    case 'primary':
      return colors.primary
    case 'onPrimary':
      return colors.onPrimary
  }
}
