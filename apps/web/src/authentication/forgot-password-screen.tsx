import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import authenticationHeroUrl from '../assets/authentication-hero.jpg'
import { CenteredPage } from '../components/ui/centered-page.js'
import { Button } from '../components/ui/button.js'

/**
 * Declara a rota de recuperação de senha sem implementar o envio: o contrato de API
 * correspondente ainda não existe, e um link quebrado na tela de entrada seria pior do
 * que uma tela que diz honestamente o que fazer enquanto isso.
 */
export function ForgotPasswordScreen(): ReactElement {
  const { t } = useTranslation()

  return (
    <CenteredPage
      title={t('authentication.forgotPassword.title')}
      hero={{ src: authenticationHeroUrl, alt: t('authentication.heroAlt') }}
    >
      <div className="flex flex-col gap-sm">
        <p className="text-body">{t('authentication.forgotPassword.unavailable')}</p>
        <Button asChild variant="outline">
          <Link to="/login">{t('authentication.login.title')}</Link>
        </Button>
      </div>
    </CenteredPage>
  )
}
