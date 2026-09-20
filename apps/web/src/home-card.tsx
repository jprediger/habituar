import type { PropsWithChildren, ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardFooter, CardHeader } from './components/ui/card.js'
import { ThemeToggle } from './theme-toggle.js'

/**
 * Moldura comum das telas de ambiente: card central, marca, título da rota e controle de
 * tema. Não conhece sessão, papel nem qual ambiente está dentro dela.
 */
export function HomeCard({
  title,
  description,
  footer,
  children,
}: PropsWithChildren<
  Readonly<{ title: string; description: string; footer?: ReactElement }>
>): ReactElement {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-lg">
      <div className="flex w-full max-w-[32rem] flex-col gap-md">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-sm">
              <p className="text-caption font-bold text-text-muted">{t('authentication.brandName')}</p>
              <ThemeToggle />
            </div>
            <h1 className="text-title font-bold">{title}</h1>
            <p className="text-caption text-text-muted">{description}</p>
          </CardHeader>
          <CardContent>{children}</CardContent>
          {footer === undefined ? undefined : <CardFooter className="justify-end">{footer}</CardFooter>}
        </Card>
      </div>
    </main>
  )
}

/** Lista de pares rótulo/valor que identificam o contexto da sessão na tela. */
export function HomeDetailList({ items }: Readonly<{ items: readonly HomeDetail[] }>): ReactElement {
  return (
    <dl className="flex flex-col gap-sm">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-none">
          <dt className="text-caption text-text-muted">{item.label}</dt>
          <dd className="text-body">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export type HomeDetail = Readonly<{ label: string; value: string }>
