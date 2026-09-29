import { SPACING } from '@habituar/design-tokens/spacing'
import { StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { SkeletonBlock } from './skeleton-block'
import { SkeletonText } from './skeleton-text'

/** Esqueleto de `FormField` com campo de texto: rótulo e a caixa na altura real do `Input`. */
export function FormFieldSkeleton() {
  const { minimumTouchTarget, compactTouchTarget } = useThemeTokens()
  return (
    <View style={styles.container}>
      <View style={[styles.label, { minHeight: compactTouchTarget }]}>
        <SkeletonText width="30%" />
      </View>
      <SkeletonBlock height={minimumTouchTarget} radius="field" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: SPACING.xs },
  label: { justifyContent: 'center' },
})
