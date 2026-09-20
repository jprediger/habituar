import { loginInputSchema } from '@habituar/core/auth/schema'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useValidatedForm } from '@habituar/react-client/form'
import { useRouter } from 'expo-router'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { TextInput } from 'react-native'
import { StyleSheet, Text, View } from 'react-native'
import { AuthenticationCard } from '../authentication-card'
import { AuthenticationFailureAlert } from '../authentication-failure-alert'
import { Button } from '../components/ui/button'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { PasswordInput } from '../components/ui/password-input'
import { getFieldErrorText } from '../form-messages'
import { habituar } from '../habituar-client'
import { useThemeTokens } from '../theme/tokens'

/** Tela de entrada: só autentica quem já tem conta. Criar conta é a rota `/register`. */
export default function LoginRoute() {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors, fontSize } = useThemeTokens()
  const { state, actions } = habituar.useAuthentication()
  const form = useValidatedForm(loginInputSchema, { email: '', password: '' })
  const passwordRef = useRef<TextInput>(null)

  const email = form.getField('email')
  const password = form.getField('password')

  const submit = form.handleSubmit(() => {
    void actions.login({ email: email.value, password: password.value })
  })

  // O hook foi escrito para o web, onde o envio chega como evento de formulário; no
  // nativo o botão é a origem, então a tela fornece o único método que o contrato usa.
  function handleSubmit(): void {
    submit({ preventDefault: () => undefined })
  }

  const isSubmitting = state.status === 'authenticating'

  return (
    <AuthenticationCard
      heading={t('authentication.login.heading')}
      description={t('authentication.login.description')}
      footer={
        <View style={styles.footer}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>
            {t('authentication.login.noAccount')}
          </Text>
          <Button
            variant="link"
            size="inline"
            label={t('authentication.register.title')}
            onPress={() => {
              router.push('/register')
            }}
          />
        </View>
      }
    >
      <FormField id="login-email" label={t('authentication.login.emailLabel')} isRequired
        error={email.error === undefined ? undefined : getFieldErrorText(email.error, t)}
      >
        {(control) => (
          <Input
            {...control}
            value={email.value}
            onChangeText={email.setValue}
            onBlur={email.markVisited}
            placeholder={t('authentication.login.emailPlaceholder')}
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
        id="login-password"
        label={t('authentication.login.passwordLabel')}
        isRequired
        error={password.error === undefined ? undefined : getFieldErrorText(password.error, t)}
        action={
          <Button
            variant="link"
            size="inline"
            label={t('authentication.login.forgotPassword')}
            onPress={() => {
              router.push('/forgot-password')
            }}
          />
        }
      >
        {(control) => (
          <PasswordInput
            {...control}
            ref={passwordRef}
            value={password.value}
            onChangeText={password.setValue}
            onBlur={password.markVisited}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
        )}
      </FormField>

      {state.status === 'failed' && <AuthenticationFailureAlert failure={state.failure} />}

      <Button
        label={isSubmitting ? t('authentication.login.submitting') : t('authentication.login.submit')}
        onPress={handleSubmit}
        isDisabled={isSubmitting}
        isBusy={isSubmitting}
        style={styles.submit}
      />
    </AuthenticationCard>
  )
}

const styles = StyleSheet.create({
  // Respiro maior antes da ação: o botão encerra o formulário, não é mais um campo.
  submit: { marginTop: SPACING.sm },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
})
