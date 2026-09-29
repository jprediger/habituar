import { SPACING } from '@habituar/design-tokens/spacing'
import type { DimensionValue } from 'react-native'
import { StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { SkeletonBlock } from './skeleton-block'
import { SkeletonText } from './skeleton-text'

/**
 * Esqueleto de `ListRow`, com as mesmas medidas: cada parte opcional da linha real tem
 * sua chave aqui, para a tela descrever a linha que vai chegar e nada mudar de lugar.
 */
export function ListRowSkeleton({
  hasIcon = false,
  hasDescription = true,
  hasValue = false,
  titleWidth = '55%',
}: Readonly<{ hasIcon?: boolean; hasDescription?: boolean; hasValue?: boolean; titleWidth?: DimensionValue }>) {
  const { minimumTouchTarget } = useThemeTokens()
  return (
    <View style={[styles.row, { minHeight: minimumTouchTarget }]}>
      {hasIcon && <SkeletonBlock width={24} height={24} radius="control" />}
      <View style={styles.text}>
        <SkeletonText width={titleWidth} />
        {hasDescription && <SkeletonText size="caption" width="35%" />}
      </View>
      {hasValue && <SkeletonBlock width={48} height={16} />}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, paddingVertical: SPACING.md },
  text: { flex: 1, gap: SPACING.xs },
})
