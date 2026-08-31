import { INestApplication } from '@nestjs/common'
import { IncomingMessage, ServerResponse } from 'node:http'

/** Cabeçalhos declarados de propósito: nenhum aqui depende de uma origem futura. */
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
}

/**
 * Dona da postura HTTP do processo: desliga o anúncio de tecnologia do Express, declara
 * cabeçalhos de segurança e a política de origem cruzada — negada por padrão, como o
 * resto da borda, até existir um cliente web que precise dela.
 */
export function configureHttpPosture(app: INestApplication): void {
  disablePoweredByHeader(app.getHttpAdapter().getInstance())

  app.use((_request: IncomingMessage, response: ServerResponse, next: () => void) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.setHeader(name, value)
    }

    next()
  })

  app.enableCors({ origin: false })
}

type DisableableInstance = { readonly disable: (setting: string) => void }

function isDisableableInstance(instance: unknown): instance is DisableableInstance {
  // A instância do Express é uma função com métodos anexados, não um objeto plano.
  return (
    (typeof instance === 'object' || typeof instance === 'function') &&
    instance !== null &&
    'disable' in instance &&
    typeof instance.disable === 'function'
  )
}

/**
 * O adaptador Express devolve a instância como `any`; a instância real sempre tem
 * `disable`, mas isto passa pelo container sem tipo algum de volta, então narra em vez
 * de confiar.
 */
function disablePoweredByHeader(instance: unknown): void {
  if (isDisableableInstance(instance)) {
    instance.disable('x-powered-by')
  }
}
