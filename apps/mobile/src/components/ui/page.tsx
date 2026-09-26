import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useThemeTokens } from '../../theme/tokens'

/**
 * Enquadramento das telas dentro de um ambiente com navegação persistente: conteúdo
 * alinhado ao topo e rolável. Recusa a borda inferior da área segura — quem a ocupa é a
 * barra de navegação, e aplicá-la aqui também abriria um vão acima da barra.
 */
export function Page({ children }: PropsWithChildren) {
  const { colors } = useThemeTokens()

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xxl, paddingBottom: SPACING.xl, gap: SPACING.xxl },
})
