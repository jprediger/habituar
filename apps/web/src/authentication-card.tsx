import type { PropsWithChildren, ReactElement } from 'react'
import { Card, CardContent, CardHeader } from './components/ui/card.js'

/**
 * Moldura comum das telas de autenticação; dona do enquadramento e do `h1` da rota —
 * não conhece formulário, estado de sessão nem qual tela está dentro dela.
 */
export function AuthenticationCard({
  title,
  hero,
  children,
}: PropsWithChildren<Readonly<{ title: string; hero?: Readonly<{ src: string; alt: string }> }>>): ReactElement {
  if (hero !== undefined) {
    return (
      <main className="grid h-dvh grid-cols-2 overflow-hidden bg-surface">
        <div className="flex min-h-0 items-center justify-center p-xl lg:p-xxl">
          <div className="flex w-full max-w-[24rem] flex-col gap-md">
            <CardHeader>
              <h1 className="text-display font-bold">{title}</h1>
            </CardHeader>
            <CardContent>{children}</CardContent>
          </div>
        </div>

        <div className="min-h-0 p-lg">
          <img src={hero.src} alt={hero.alt} className="h-full w-full rounded-surface object-cover" />
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-lg">
      <div className="flex w-full max-w-[24rem] flex-col gap-md">
        <Card>
          <CardHeader>
            <h1 className="text-title font-bold">{title}</h1>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  )
}
