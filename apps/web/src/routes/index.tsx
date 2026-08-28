import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '../components/ui/card.js'

export const Route = createFileRoute('/')({
  component: HealthRoute,
})

/**
 * Única tela do M0. A ligação com `habituar.useHealth()` entra no commit seguinte — aqui
 * só existem a rota, o catálogo pt-BR e a hierarquia visual (main > h1 > card).
 */
export function HealthRoute(): ReactElement {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-lg">
      <div className="flex w-full flex-col gap-md">
        <h1 className="text-display font-bold text-text">{t('health.title')}</h1>
        <Card>
          <CardContent>
            <div role="status" aria-live="polite" className="text-body">
              <p>{t('health.loading')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
