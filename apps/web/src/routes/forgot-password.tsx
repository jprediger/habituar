import { Link, createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import authenticationHeroUrl from '../assets/authentication-hero.jpg'
import { AuthenticationCard } from '../authentication-card.js'
import { Button } from '../components/ui/button.js'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordRoute,
})

/**
 * Declara a rota de recuperação de senha sem implementar o envio: o contrato de API
 * correspondente ainda não existe, e um link quebrado na tela de entrada seria pior do
 * que uma tela que diz honestamente o que fazer enquanto isso.
 */
export function ForgotPasswordRoute(): ReactElement {
  const { t } = useTranslation()

  return (
    <AuthenticationCard
      title={t('authentication.forgotPassword.title')}
      hero={{ src: authenticationHeroUrl, alt: t('authentication.heroAlt') }}
    >
      <div className="flex flex-col gap-sm">
        <p className="text-body">{t('authentication.forgotPassword.unavailable')}</p>
        <Button asChild variant="outline">
          <Link to="/login">{t('authentication.login.title')}</Link>
        </Button>
      </div>
    </AuthenticationCard>
  )
}
