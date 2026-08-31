import { assertNever } from '@habituar/core/assert-never'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { HealthState } from '@habituar/react-client/react-client'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { habituar } from '../habituar-client'
import { useThemeTokens } from '../theme/tokens'

/**
 * Única tela do M0: mostra o estado de `GET /v1/health` pela interface pública do
 * react-client. Não guarda estado próprio nem decide o que fazer no retry — só lê
 * `useHealth()` e repassa `retry()` ao Pressable.
 */
export default function HealthScreen() {
  const { t } = useTranslation()
  const { state, retry } = habituar.useHealth()
  const { colors, minimumTouchTarget } = useThemeTokens()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t('screenTitle')}
      </Text>

      {/* Mesmo elemento em todos os estados: uma live region só anuncia mudança de
          conteúdo se o nó já existia antes da mudança, não se ele aparece do zero. */}
      <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.textMuted }]}>
        {healthStateMessage(state, t)}
      </Text>

      {state.status === 'failed' && (
        <Pressable
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel={t('retryLabel')}
          style={[
            styles.retryButton,
            {
              backgroundColor: colors.primary,
              minHeight: minimumTouchTarget,
              minWidth: minimumTouchTarget,
            },
          ]}
        >
          <Text style={{ color: colors.onPrimary }}>{t('retryLabel')}</Text>
        </Pressable>
      )}
    </SafeAreaView>
  )
}

/**
 * Único ponto que traduz `HealthState` em texto: nenhuma outra parte da tela decide o
 * que mostrar por estado. `failed` nunca carrega o motivo técnico da falha (D-erros).
 */
function healthStateMessage(state: HealthState, t: ReturnType<typeof useTranslation>['t']): string {
  switch (state.status) {
    case 'loading':
      return t('loading')
    case 'ready':
      return `${t('readyStatusOk')} · ${t('readyVersion', { version: state.value.version })}`
    case 'failed':
      return t('failedMessage')
    default:
      return assertNever(state)
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
})
