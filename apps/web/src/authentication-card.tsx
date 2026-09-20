import type { PropsWithChildren, ReactElement } from 'react'
import { BrandLogo } from './brand-logo.js'
import { Card, CardContent, CardHeader } from './components/ui/card.js'

/**
 * Moldura comum das telas de autenticação; dona do enquadramento e do `h1` da rota —
 * não conhece formulário, estado de sessão nem qual tela está dentro dela.
 */
export function AuthenticationCard({
  title,
  children,
}: PropsWithChildren<Readonly<{ title: string }>>): ReactElement {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-lg">
      <div className="flex w-full max-w-[24rem] flex-col gap-md">
        <Card>
          <CardHeader className="items-center gap-sm">
            <BrandLogo />
            <h1 className="text-title font-bold">{title}</h1>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  )
}
