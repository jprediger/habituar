import { SPACING } from '@habituar/design-tokens/spacing'
import { useLoginForm } from '@habituar/react-client/login-form'
import { useRouter } from 'expo-router'
import { useRef } from 'react'
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

/** Tela de entrada: só autentica quem já tem conta. Criar conta é a rota `/register`. */
export function LoginScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const form = useLoginForm(habituar.useAuthentication())
  const passwordRef = useRef<TextInput>(null)

  const email = form.getField('email')
  const password = form.getField('password')

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
            onSubmitEditing={form.submit}
          />
        )}
      </FormField>

      {form.failure !== undefined && <AuthenticationFailureAlert failure={form.failure} />}

      <Button
        icon="log-in-outline"
        label={form.isSubmitting ? t('authentication.login.submitting') : t('authentication.login.submit')}
        onPress={form.submit}
        isDisabled={form.isSubmitting}
        isBusy={form.isSubmitting}
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
