import type { PropsWithChildren, ReactElement } from 'react'
import { BrandMark } from './brand-mark.js'
import { Card, CardContent, CardHeader } from './card.js'

/**
 * Página centralizada com título e conteúdo, com ou sem imagem ao lado: a moldura de toda
 * tela que não vive dentro de um ambiente. Dona do enquadramento, da marca e do `h1` da rota — não
 * conhece formulário, sessão nem qual tela está dentro dela, e é por isso que serve tanto
 * a entrada quanto a espera e a falha de sessão.
 */
export function CenteredPage({
  title,
  hero,
  children,
}: PropsWithChildren<Readonly<{ title: string; hero?: Readonly<{ src: string; alt: string }> }>>): ReactElement {
  if (hero !== undefined) {
    return (
      <main className="grid h-dvh grid-cols-2 overflow-hidden bg-surface">
        <div className="flex min-h-0 items-center justify-center p-xl lg:p-xxl">
          <div className="flex w-full max-w-[24rem] flex-col gap-md">
            {/* O espaço maior abaixo da marca separa a identidade do título da rota, como
                no app: sem ele o logo parece parte do título. */}
            <div className="mb-lg">
              <BrandMark size="page" />
            </div>
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
        <div className="mb-md flex justify-center">
          <BrandMark size="page" />
        </div>
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
