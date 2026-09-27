import type { ProfessionalNavigationIcon } from '@habituar/react-client/professional-navigation'
import Svg, { Path } from 'react-native-svg'

type NavigationIconWeight = 'regular' | 'fill'

// Desenhos do Phosphor Icons (MIT, phosphoricons.com), grade de 256. Copiados em vez de
// importar `phosphor-react-native`: a raiz do pacote arrasta os ~1.500 ícones para o
// bundle (o Metro não faz tree-shaking), e o import por ícone expõe a fonte da biblioteca
// ao nosso typecheck estrito. Ícone novo no catálogo quebra o build aqui até ganhar os
// pesos `regular` e `fill`, copiados do site.
const GLYPHS: Readonly<Record<ProfessionalNavigationIcon, Readonly<Record<NavigationIconWeight, string>>>> = {
  home: {
    regular:
      'm219.31 108.68-80-80a16 16 0 0 0-22.62 0l-80 80A15.87 15.87 0 0 0 32 120v96a8 8 0 0 0 8 8h64a8 8 0 0 0 8-8v-56h32v56a8 8 0 0 0 8 8h64a8 8 0 0 0 8-8v-96a15.87 15.87 0 0 0-4.69-11.32M208 208h-48v-56a8 8 0 0 0-8-8h-48a8 8 0 0 0-8 8v56H48v-88l80-80 80 80Z',
    fill: 'M224 120v96a8 8 0 0 1-8 8h-56a8 8 0 0 1-8-8v-52a4 4 0 0 0-4-4h-40a4 4 0 0 0-4 4v52a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8v-96a16 16 0 0 1 4.69-11.31l80-80a16 16 0 0 1 22.62 0l80 80A16 16 0 0 1 224 120',
  },
  user: {
    regular:
      'M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24M74.08 197.5a64 64 0 0 1 107.84 0 87.83 87.83 0 0 1-107.84 0M96 120a32 32 0 1 1 32 32 32 32 0 0 1-32-32m97.76 66.41a79.66 79.66 0 0 0-36.06-28.75 48 48 0 1 0-59.4 0 79.66 79.66 0 0 0-36.06 28.75 88 88 0 1 1 131.52 0',
    fill: 'M172 120a44 44 0 1 1-44-44 44.05 44.05 0 0 1 44 44m60 8A104 104 0 1 1 128 24a104.11 104.11 0 0 1 104 104m-16 0a88.09 88.09 0 0 0-91.47-87.93C77.43 41.89 39.87 81.12 40 128.25a87.65 87.65 0 0 0 22.24 58.16A79.7 79.7 0 0 1 84 165.1a4 4 0 0 1 4.83.32 59.83 59.83 0 0 0 78.28 0 4 4 0 0 1 4.83-.32 79.7 79.7 0 0 1 21.79 21.31A87.62 87.62 0 0 0 216 128',
  },
}

/**
 * Desenho do ícone lógico da navegação. Dono só da forma: qual peso usar (contorno ou
 * preenchido) e a cor são decisão de quem mostra o ícone.
 */
export function NavigationIcon({
  icon,
  weight,
  size,
  color,
}: Readonly<{ icon: ProfessionalNavigationIcon; weight: NavigationIconWeight; size: number; color: string }>) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Path d={GLYPHS[icon][weight]} fill={color} />
    </Svg>
  )
}
