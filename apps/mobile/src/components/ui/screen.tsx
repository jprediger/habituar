import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useThemeTokens } from '../../theme/tokens'

/**
 * Enquadramento externo de toda tela do app: área segura, teclado e rolagem. Existe para
 * que nem o teclado aberto nem a fonte ampliada do sistema escondam o que a pessoa
 * precisa tocar — por isso nada aqui desliga o escalonamento de fonte.
 */
export function Screen({ children }: PropsWithChildren) {
  const { colors } = useThemeTokens()

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView
        // Só o iOS empurra o conteúdo: no Android o `adjustResize` da janela já o faz, e
        // aplicar os dois desloca a tela duas vezes.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safeArea}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          // Centraliza enquanto couber e rola quando não couber: é o mesmo container nos
          // dois casos, então fonte grande nunca corta o fim do formulário.
          contentContainerStyle={styles.content}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg, gap: SPACING.md },
})
