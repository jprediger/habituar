import { StyleSheet, View } from 'react-native'
import { useThemeTokens } from './theme/tokens'

const OUTER_RING = 112
const MIDDLE_RING = 80
const CORE = 40

/**
 * A marca no topo das telas de autenticação. Anéis concêntricos em `View`: nada de SVG,
 * porque uma dependência de renderização vetorial não se paga por três círculos, e nada
 * de arquivo de imagem, porque a declaração de módulo de asset é gerada pelo Expo e não
 * existe no ambiente que só roda `tsc`.
 */
export function BrandMark() {
  const { colors } = useThemeTokens()

  return (
    <View
      // Decoração: quem usa leitor de tela já ouve o nome do produto no título da tela.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ring, ringSize(OUTER_RING), { backgroundColor: colors.surfaceMuted }]}
    >
      <View style={[styles.ring, ringSize(MIDDLE_RING), { borderWidth: 2, borderColor: colors.primary }]}>
        <View style={[styles.ring, ringSize(CORE), { backgroundColor: colors.primary }]} />
      </View>
    </View>
  )
}

function ringSize(size: number) {
  return { width: size, height: size, borderRadius: size / 2 }
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
})
