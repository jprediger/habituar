import type { DimensionValue } from 'react-native'
import { StyleSheet, View } from 'react-native'
import type { TextSize } from '../ui/text'
import { useThemeTokens } from '../../theme/tokens'
import { SkeletonBlock } from './skeleton-block'

/**
 * Uma linha de texto em esqueleto. Ocupa a mesma altura de linha que `Text` no tamanho
 * dado, com a barra na altura da fonte: é o que evita o salto quando o texto real chega.
 */
export function SkeletonText({ size = 'body', width = '60%' }: Readonly<{ size?: TextSize; width?: DimensionValue }>) {
  const { fontSize, lineHeight } = useThemeTokens()
  const lineBoxHeight = size === 'display' || size === 'title' ? lineHeight[size].tight : lineHeight[size].normal
  return (
    <View style={[styles.line, { height: lineBoxHeight }]}>
      <SkeletonBlock width={width} height={fontSize[size]} radius="button" />
    </View>
  )
}

const styles = StyleSheet.create({
  line: { justifyContent: 'center' },
})
