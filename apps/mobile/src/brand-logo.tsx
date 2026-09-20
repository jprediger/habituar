import Svg, { Path } from 'react-native-svg'
import { useThemeTokens } from './theme/tokens'

/**
 * Marca do produto. **Provisória**: é um sinal geométrico com a forma e as cores certas,
 * para a tela não ficar órfã de marca enquanto a definitiva não existe. A gêmea em
 * `apps/web/src/brand-logo.tsx` desenha exatamente esta geometria — as duas mudam juntas.
 *
 * Não é componente compartilhado entre plataformas de propósito: a consistência vem dos
 * tokens de cor e do raio, não de um componente que precisaria conhecer as duas.
 */
export function BrandLogo({ size = LOGO_SIZE }: Readonly<{ size?: number }>) {
  const { colors } = useThemeTokens()

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      // Decoração: quem usa leitor de tela já ouve o nome do produto no título da tela.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ alignSelf: 'center' }}
    >
      <Path d={SQUARE} fill={colors.primary} />
      <Path
        d={CHECK}
        stroke={colors.onPrimary}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

const LOGO_SIZE = 64
// Quadrado arredondado desenhado como path: o `x`/`y` de `Rect` está depreciado no
// react-native-svg, e path mantém as duas plataformas com a geometria idêntica, caractere
// por caractere. Inserção de 2 em 48, raio de 14 — o mesmo raio dos campos, em escala.
const SQUARE =
  'M16 2 H32 A14 14 0 0 1 46 16 V32 A14 14 0 0 1 32 46 H16 A14 14 0 0 1 2 32 V16 A14 14 0 0 1 16 2 Z'
// Um visto — rotina cumprida é o que o produto acompanha.
const CHECK = 'M15 24.5 l6.5 6.5 L33 17'
