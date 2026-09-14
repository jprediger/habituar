import { SPACING } from '@habituar/design-tokens/spacing'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
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

  function failureText(code: string): string {
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
  const titleKey = mode === 'login' ? 'authentication.login' : 'authentication.register'
  const descriptionKey = mode === 'login' ? 'authentication.loginDescription' : 'authentication.registerDescription'

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t(titleKey)}
      </Text>

      {mode === 'login' && state.status === 'authenticated' ? (
        <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.text }]}>
          {t('authentication.loginSuccess', {
            destination: t(`home.${state.session.destination}`),
          })}
        </Text>
      ) : (
        <>
          <Text style={[styles.description, { color: colors.textMuted }]}>{t(descriptionKey)}</Text>

          {mode === 'register' && (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('authentication.nameLabel')}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { borderColor: colors.textMuted, color: colors.text }]}
            />
          )}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('authentication.emailLabel')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { borderColor: colors.textMuted, color: colors.text }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t('authentication.passwordLabel')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={[styles.input, { borderColor: colors.textMuted, color: colors.text }]}
          />

          {mode === 'login' && state.status === 'failed' && (
            <Text accessibilityRole="alert" style={[styles.message, { color: colors.text }]}>
              {failureText(state.failure)}
            </Text>
          )}
          {mode === 'register' && registerState.status === 'failed' && (
            <Text accessibilityRole="alert" style={[styles.message, { color: colors.text }]}>
              {failureText(registerState.code)}
            </Text>
          )}
          {mode === 'register' && registerState.status === 'succeeded' && (
            <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.text }]}>
              {t('authentication.registerSuccess')}
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
              {isSubmitting ? t('authentication.submitting') : t(titleKey)}
            </Text>
          </Pressable>
        </>
      )}

      <Pressable
        onPress={() => {
          setMode(mode === 'login' ? 'register' : 'login')
        }}
        accessibilityRole="button"
        accessibilityLabel={mode === 'login' ? t('authentication.register') : t('authentication.login')}
        style={styles.switchButton}
      >
        <Text style={{ color: colors.primary }}>
          {mode === 'login' ? t('authentication.register') : t('authentication.login')}
        </Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'stretch', justifyContent: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: SPACING.sm },
  description: { fontSize: 14, textAlign: 'center', marginBottom: SPACING.md },
  message: { fontSize: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: 16 },
  submitButton: { alignItems: 'center', justifyContent: 'center', borderRadius: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  switchButton: { alignItems: 'center', paddingVertical: SPACING.sm },
})