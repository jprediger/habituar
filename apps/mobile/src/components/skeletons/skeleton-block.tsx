import type { DimensionValue } from 'react-native'
import { View } from 'react-native'
import type { RadiusRole } from '@habituar/design-tokens/radius'
import { useThemeTokens } from '../../theme/tokens'

/**
 * Forma mínima de esqueleto: um retângulo na cor de superfície atenuada. Não anima nem se
 * anuncia sozinho — isso é da raiz `Skeleton`, para todos os blocos pulsarem juntos.
 */
export function SkeletonBlock({ width = '100%', height, radius = 'button' }: Readonly<{ width?: DimensionValue; height: number; radius?: RadiusRole }>) {
  const { colors, radius: radii } = useThemeTokens()
  return <View style={{ width, height, borderRadius: radii[radius], backgroundColor: colors.surfaceMuted }} />
}
