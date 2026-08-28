import type { HabituarReactClient } from '@habituar/react-client/react-client'
import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button.js'
import { Card, CardContent } from '../components/ui/card.js'
import { habituar } from '../habituar-client.js'

export const Route = createFileRoute('/')({
  component: HealthRoute,
})

export type HealthRouteProps = Readonly<{
  client?: HabituarReactClient
}>

/**
 * Única tela do M0. Conhece só `client.useHealth()` — nunca oRPC nem TanStack Query
 * diretamente — e nunca renderiza detalhe técnico da falha, só o texto pt-BR do catálogo.
 * `client` recebe a instância real da SPA por padrão; testes passam uma instância isolada
 * própria, já que o `react-client` não expõe reset exclusivo de teste.
 */
export function HealthRoute({ client = habituar }: HealthRouteProps = {}): ReactElement {
  const { t } = useTranslation()
  const { state, retry } = client.useHealth()

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-lg">
      <div className="flex w-full flex-col gap-md">
        <h1 className="text-display font-bold text-text">{t('health.title')}</h1>
        <Card>
          <CardContent>
            <div role="status" aria-live="polite" className="text-body">
              {state.status === 'loading' && <p>{t('health.loading')}</p>}
              {state.status === 'ready' && (
                <div className="flex flex-col gap-xs">
                  <p>{t('health.readyStatusOk')}</p>
                  <p className="text-caption text-text-muted">
                    {t('health.readyVersion', { version: state.value.version })}
                  </p>
                </div>
              )}
              {state.status === 'failed' && <p>{t('health.failedMessage')}</p>}
            </div>
            {state.status === 'failed' && <Button onClick={retry}>{t('health.retry')}</Button>}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
