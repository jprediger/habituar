import { loginInputSchema } from '@habituar/core/auth/schema'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useValidatedForm } from '@habituar/react-client/form'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TextInput } from 'react-native'
import { StyleSheet, View } from 'react-native'
import { AuthenticationCard } from './authentication-card'
import { AuthenticationFailureAlert } from './authentication-failure-alert'
import { Button } from '../components/ui/button'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { Text } from '../components/ui/text'
import { PasswordInput } from '../components/ui/password-input'
import { getFieldErrorText } from './form-messages'
import { habituar } from '../client/habituar-client'
import authenticationHero from '../../assets/images/authentication-hero.jpg'

// Credenciais do último envio, para a tela saber se a falha ainda fala do que está nos
// campos. Não é estado de sessão: morre com a tela, como a digitação.
type Attempt = Readonly<{ email: string; password: string }>

function hasChangedSince(attempt: Attempt | undefined, email: string, password: string): boolean {
  if (attempt === undefined) return false
  return attempt.email !== email || attempt.password !== password
}

/** Tela de entrada: só autentica quem já tem conta. Criar conta é a rota `/register`. */
export function LoginScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { state, actions } = habituar.useAuthentication()
  const form = useValidatedForm(loginInputSchema, { email: '', password: '' })
  const passwordRef = useRef<TextInput>(null)

  const email = form.getField('email')
  const password = form.getField('password')
  const [attempt, setAttempt] = useState<Attempt | undefined>(undefined)

  const submit = form.handleSubmit(() => {
    setAttempt({ email: email.value, password: password.value })
    void actions.login({ email: email.value, password: password.value })
  })

  // O hook foi escrito para o web, onde o envio chega como evento de formulário; no
  // nativo o botão é a origem, então a tela fornece o único método que o contrato usa.
  function handleSubmit(): void {
    submit({ preventDefault: () => undefined })
  }

  const isSubmitting = state.status === 'authenticating'

  // A falha descreve a tentativa enviada, não o formulário: mantê-la depois que a pessoa
  // corrige o campo acusa um erro que já não existe, e o estado da sessão só muda no
  // próximo envio. Sem tentativa registrada, a falha veio da restauração da sessão — essa
  // não pertence ao formulário e continua na tela.
  const failure =
    state.status === 'failed' && !hasChangedSince(attempt, email.value, password.value)
      ? state.failure
      : undefined

  return (
    <AuthenticationCard
      heading={t('authentication.login.heading')}
      description={t('authentication.login.description')}
      hero={authenticationHero}
      footer={
        <View style={styles.footer}>
          <Text tone="muted">
            {t('authentication.login.noAccount')}
          </Text>
          <Button
            variant="link"
            size="inlineBody"
            label={t('authentication.register.title')}
            onPress={() => {
              router.push('/register')
            }}
          />
        </View>
      }
    >
      <View style={styles.emailField}>
        <FormField id="login-email" label={t('authentication.login.emailLabel')} isRequired
          error={email.error === undefined ? undefined : getFieldErrorText(email.error, t)}
        >
          {(control) => (
            <Input
              {...control}
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
      </View>

      <FormField
        id="login-password"
        label={t('authentication.login.passwordLabel')}
        isRequired
        error={password.error === undefined ? undefined : getFieldErrorText(password.error, t)}
        action={
          <Button
            variant="link"
            size="inlineBody"
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

      {failure !== undefined && <AuthenticationFailureAlert failure={failure} />}

      <Button
        icon="log-in-outline"
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
  emailField: { marginTop: SPACING.md },
  submit: { marginTop: SPACING.lg },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
})
