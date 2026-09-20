import Svg, { Rect, Text as SvgText } from 'react-native-svg'
import { useThemeTokens } from './theme/tokens'

const WIDTH = 120
const HEIGHT = 56
// Meia espessura do traço de recuo, para a borda não sair cortada pelo viewBox.
const INSET = 1
const STROKE_WIDTH = 2
const DASH = [6, 5]
const CORNER = 14
const PLACEHOLDER_TEXT = 'LOGO'

/**
 * Espaço reservado da marca, **deliberadamente provisório**: moldura tracejada com a
 * palavra LOGO, para ninguém confundir com a marca definitiva nem esquecê-la aqui. A
 * gêmea em `apps/web/src/brand-logo.tsx` desenha a mesma geometria — as duas mudam juntas.
 *
 * Não é componente compartilhado entre plataformas de propósito: a consistência vem dos
 * tokens de cor e do raio, não de um componente que precisaria conhecer as duas.
 */
export function BrandLogo() {
  const { colors } = useThemeTokens()

  return (
    <Svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      // Decoração: quem usa leitor de tela já ouve o nome do produto no título da tela.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ alignSelf: 'center' }}
    >
      {/* Posição pela string de `transform`: o react-native-svg depreciou `x`/`y` e os
          atalhos `translateX`/`translateY`, e a forma de objeto que ele sugere colide com
          o tipo `transform` do React Native. */}
      <Rect
        transform={`translate(${String(INSET)}, ${String(INSET)})`}
        width={WIDTH - INSET * 2}
        height={HEIGHT - INSET * 2}
        rx={CORNER}
        fill="none"
        stroke={colors.textMuted}
        strokeWidth={STROKE_WIDTH}
        strokeDasharray={DASH}
      />
      <SvgText
        transform={`translate(${String(WIDTH / 2)}, ${String(HEIGHT / 2)})`}
        textAnchor="middle"
        // `dominantBaseline` não é confiável no Android; `alignmentBaseline` é o que o
        // react-native-svg honra nas duas plataformas.
        alignmentBaseline="central"
        fontSize={20}
        fontWeight="700"
        letterSpacing={3}
        fill={colors.textMuted}
      >
        {PLACEHOLDER_TEXT}
      </SvgText>
    </Svg>
  )
}
