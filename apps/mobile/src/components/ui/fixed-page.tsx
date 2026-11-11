import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PageSkeleton } from '../skeletons/page-skeleton'
import { useThemeTokens } from '../../theme/tokens'
import { DeferredMount } from './deferred-mount'

/**
 * Mesmo enquadramento de `Page` para a raiz de aba, mas sem rolar: o conteúdo recebe a
 * altura da tela. Existe para telas que são donas da própria rolagem, como a agenda —
 * dentro de uma rolagem sem limite elas cresceriam até o fim e nunca rolariam.
 */
export function FixedPage({ children }: PropsWithChildren) {
  const { colors } = useThemeTokens()

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <View style={styles.content}>
        <DeferredMount fallback={<PageSkeleton />}>{children}</DeferredMount>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xxl, paddingBottom: SPACING.xl, gap: SPACING.xxl },
})
