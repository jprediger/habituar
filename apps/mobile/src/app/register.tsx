import { assertNever } from '@habituar/core/assert-never'
import { registerInputSchema } from '@habituar/core/auth/schema'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useValidatedForm } from '@habituar/react-client/form'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TextInput } from 'react-native'
import { StyleSheet, Text, View } from 'react-native'
import { AuthenticationCard } from '../authentication-card'
import { Button } from '../components/ui/button'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { PasswordInput } from '../components/ui/password-input'
import { getFieldErrorText } from '../form-messages'
import { habituar } from '../habituar-client'
import { useThemeTokens } from '../theme/tokens'

const MINIMUM_PASSWORD_LENGTH = 8

// Falhas que o cadastro sabe explicar. Qualquer outra vira `network`: mensagem de erro do
// servidor não chega ao usuário, e o union fechado evita texto genérico por omissão.
type RegisterFailure = 'conflict' | 'network'

type RegisterUiState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'submitting' }>
  | Readonly<{ status: 'succeeded' }>
  | Readonly<{ status: 'failed'; failure: RegisterFailure }>

function toRegisterFailure(error: unknown): RegisterFailure {
  if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'conflict') {
    return 'conflict'
  }

  return 'network'
}

function getRegisterFailureText(
  failure: RegisterFailure,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  switch (failure) {
    case 'conflict':
      return t('authentication.failure.conflict')
    case 'network':
      return t('authentication.failure.network')
    default:
      return assertNever(failure)
  }
}

/**
 * Tela de criação de conta. Registro não emite sessão (ver `auth.contract.ts`), por isso
 * ela tem estado próprio e termina convidando a entrar, nunca autenticando sozinha.
 */
export default function RegisterRoute() {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors, fontSize } = useThemeTokens()
  const { actions } = habituar.useAuthentication()
  const [registerState, setRegisterState] = useState<RegisterUiState>({ status: 'idle' })
  const form = useValidatedForm(registerInputSchema, { name: '', email: '', password: '' })
  const emailRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)

  const name = form.getField('name')
  const email = form.getField('email')
  const password = form.getField('password')

  const submit = form.handleSubmit(() => {
    setRegisterState({ status: 'submitting' })

    actions
      .register({ name: name.value, email: email.value, password: password.value })
      .then(() => {
        setRegisterState({ status: 'succeeded' })
      })
      .catch((error: unknown) => {
        setRegisterState({ status: 'failed', failure: toRegisterFailure(error) })
      })
  })

  function handleSubmit(): void {
    submit({ preventDefault: () => undefined })
  }

  const isSubmitting = registerState.status === 'submitting'

  return (
    <AuthenticationCard
      heading={t('authentication.register.heading')}
      description={t('authentication.register.description')}
      footer={
        <View style={styles.footer}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>
            {t('authentication.register.haveAccount')}
          </Text>
          <Button
            variant="link"
            size="inline"
            label={t('authentication.login.title')}
            onPress={() => {
              router.replace('/login')
            }}
          />
        </View>
      }
    >
      {registerState.status === 'succeeded' ? (
        <View style={styles.success}>
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.text, fontSize: fontSize.body }}
          >
            {t('authentication.register.success')}
          </Text>
          <Button
            icon="log-in-outline"
            label={t('authentication.login.title')}
            onPress={() => {
              router.replace('/login')
            }}
          />
        </View>
      ) : (
        <>
          <FormField id="register-name" label={t('authentication.register.nameLabel')} isRequired
            error={name.error === undefined ? undefined : getFieldErrorText(name.error, t)}
          >
            {(control) => (
              <Input
                {...control}
                value={name.value}
                onChangeText={name.setValue}
                onBlur={name.markVisited}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            )}
          </FormField>

          <FormField id="register-email" label={t('authentication.register.emailLabel')} isRequired
            error={email.error === undefined ? undefined : getFieldErrorText(email.error, t)}
          >
            {(control) => (
              <Input
                {...control}
                ref={emailRef}
                value={email.value}
                onChangeText={email.setValue}
                onBlur={email.markVisited}
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            )}
          </FormField>

          <FormField
            id="register-password"
            label={t('authentication.register.passwordLabel')}
            isRequired
            hint={t('authentication.register.passwordHint', { minimum: MINIMUM_PASSWORD_LENGTH })}
            error={password.error === undefined ? undefined : getFieldErrorText(password.error, t)}
          >
            {(control) => (
              <PasswordInput
                {...control}
                ref={passwordRef}
                value={password.value}
                onChangeText={password.setValue}
                onBlur={password.markVisited}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
            )}
          </FormField>

          {registerState.status === 'failed' && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ color: colors.danger, fontSize: fontSize.caption }}
            >
              {getRegisterFailureText(registerState.failure, t)}
            </Text>
          )}

          <Button
            icon="person-add-outline"
            label={isSubmitting ? t('authentication.register.submitting') : t('authentication.register.submit')}
            onPress={handleSubmit}
            isDisabled={isSubmitting}
            isBusy={isSubmitting}
            style={styles.submit}
          />
        </>
      )}
    </AuthenticationCard>
  )
}

const styles = StyleSheet.create({
  submit: { marginTop: SPACING.sm },
  success: { gap: SPACING.md },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
})
