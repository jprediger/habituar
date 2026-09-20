import { SPACING } from '@habituar/design-tokens/spacing'
import type { AuthenticationFailure } from '@habituar/react-client/react-client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getAuthenticationFailureRecovery, getAuthenticationFailureText } from '../authentication-messages'
import { habituar } from '../habituar-client'
import { useThemeTokens } from '../theme/tokens'

type Mode = 'login' | 'register'
type RegisterUiState = { status: 'idle' } | { status: 'succeeded' } | { status: 'failed'; code: string }
type FailureCode = 'invalid-credentials' | 'network' | 'conflict' | 'no-memberships' | 'forbidden'

export default function AuthScreen() {
  const { t } = useTranslation()
  const { colors, minimumTouchTarget } = useThemeTokens()
  const { state, actions } = habituar.useAuthentication()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [registerState, setRegisterState] = useState<RegisterUiState>({ status: 'idle' })

  function normalizeFailureCode(code: string): FailureCode {
    switch (code) {
      case 'invalid-credentials':
      case 'conflict':
      case 'no-memberships':
      case 'forbidden':
      case 'network':
        return code
      default:
        return 'network'
    }
  }

  function registerFailureText(code: string): string {
    switch (normalizeFailureCode(code)) {
      case 'invalid-credentials':
        return t('authentication.failure.invalid-credentials')
      case 'conflict':
        return t('authentication.failure.conflict')
      case 'no-memberships':
        return t('authentication.failure.no-memberships')
      case 'forbidden':
        return t('authentication.failure.forbidden')
      case 'network':
        return t('authentication.failure.network')
      default:
        return t('authentication.failure.network')
    }
  }

  function handleSubmit(): void {
    if (mode === 'login') {
      void actions.login({ email, password })
      return
    }

    setRegisterState({ status: 'idle' })
    actions
      .register({ email, password, name })
      .then(() => {
        setRegisterState({ status: 'succeeded' })
      })
      .catch((error: unknown) => {
        const code =
          error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
            ? error.code
            : 'network'
        setRegisterState({ status: 'failed', code })
      })
  }

  const isSubmitting = mode === 'login' && state.status === 'authenticating'
  const titleKey = mode === 'login' ? 'authentication.login.title' : 'authentication.register.title'
  const descriptionKey =
    mode === 'login' ? 'authentication.login.description' : 'authentication.register.description'

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t(titleKey)}
      </Text>

      <>
          <Text style={[styles.description, { color: colors.textMuted }]}>{t(descriptionKey)}</Text>

          {mode === 'register' && (
            <TextInput
              value={name}
              onChangeText={setName}
              accessibilityLabel={t('authentication.register.nameLabel')}
            placeholder={t('authentication.register.nameLabel')}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { borderColor: colors.textMuted, color: colors.text }]}
            />
          )}
          <TextInput
            value={email}
            onChangeText={setEmail}
            accessibilityLabel={t('authentication.login.emailLabel')}
            placeholder={t('authentication.login.emailLabel')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { borderColor: colors.textMuted, color: colors.text }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            accessibilityLabel={t('authentication.login.passwordLabel')}
            placeholder={t('authentication.login.passwordLabel')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={[styles.input, { borderColor: colors.textMuted, color: colors.text }]}
          />

          {mode === 'login' && state.status === 'failed' && (
            <>
              <Text accessibilityRole="alert" style={[styles.message, { color: colors.danger }]}>
                {getAuthenticationFailureText(state.failure, t)}
              </Text>
              <FailureRecovery failure={state.failure} />
            </>
          )}
          {mode === 'register' && registerState.status === 'failed' && (
            <Text accessibilityRole="alert" style={[styles.message, { color: colors.text }]}>
              {registerFailureText(registerState.code)}
            </Text>
          )}
          {mode === 'register' && registerState.status === 'succeeded' && (
            <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.text }]}>
              {t('authentication.register.success')}
            </Text>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={t(titleKey)}
            style={[
              styles.submitButton,
              {
                backgroundColor: colors.primary,
                minHeight: minimumTouchTarget,
                minWidth: minimumTouchTarget,
                opacity: isSubmitting ? 0.6 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.onPrimary }}>
              {isSubmitting ? t('authentication.login.submitting') : t(titleKey)}
            </Text>
          </Pressable>
      </>

      <Pressable
        onPress={() => {
          setMode(mode === 'login' ? 'register' : 'login')
        }}
        accessibilityRole="button"
        accessibilityLabel={mode === 'login' ? t('authentication.register.title') : t('authentication.login.title')}
        style={styles.switchButton}
      >
        <Text style={{ color: colors.primary }}>
          {mode === 'login' ? t('authentication.register.title') : t('authentication.login.title')}
        </Text>
      </Pressable>
    </SafeAreaView>
  )
}

/**
 * Saída oferecida junto do alerta de falha. Sem ela, `no-memberships` e `forbidden` —
 * que acontecem com token já gravado — prendem a pessoa no mesmo estado a cada abertura.
 */
function FailureRecovery({ failure }: Readonly<{ failure: AuthenticationFailure }>) {
  const { t } = useTranslation()
  const { colors, minimumTouchTarget } = useThemeTokens()
  const { actions } = habituar.useAuthentication()
  const recovery = getAuthenticationFailureRecovery(failure)

  if (recovery === 'none') return null

  const label = recovery === 'retry' ? t('authentication.failure.retry') : t('authentication.failure.signOut')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        if (recovery === 'retry') {
          void actions.retry()
          return
        }

        void actions.logout()
      }}
      style={[styles.recoveryButton, { minHeight: minimumTouchTarget }]}
    >
      <Text style={{ color: colors.primary }}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'stretch', justifyContent: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: SPACING.sm },
  description: { fontSize: 14, textAlign: 'center', marginBottom: SPACING.md },
  message: { fontSize: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: 16 },
  submitButton: { alignItems: 'center', justifyContent: 'center', borderRadius: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  recoveryButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm },
  switchButton: { alignItems: 'center', paddingVertical: SPACING.sm },
})