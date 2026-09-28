import { ConfigService } from '@nestjs/config'
import { Environment } from '../environment/environment.schema.js'
import { AppLogger } from './app-logger.js'

/**
 * Porta de entrega de convites. Existem dois adaptadores reais e a escolha é configuração
 * de boot; nenhum chamador sabe qual deles recebeu.
 */
export type EmailSender = Readonly<{
  sendInvitation(input: Readonly<{ email: string; inviteUrl: string }>): Promise<void>
}>

export const EMAIL_SENDER = Symbol('EmailSender')

/** Adaptador de desenvolvimento: o link inteiro vai para o log, por isso o boot o recusa em produção. */
export function createLogEmailSender(logger: AppLogger): EmailSender {
  return {
    sendInvitation(input) {
      logger.log({ message: 'Development invitation delivery', email: input.email, inviteUrl: input.inviteUrl })
      return Promise.resolve()
    },
  }
}

/** Adaptador de produção enquanto não há provedor: o link só existe na resposta de criação. */
export function createDisabledEmailSender(): EmailSender {
  return { sendInvitation: () => Promise.resolve() }
}

/** Escolhe o adaptador a partir de `EMAIL_TRANSPORT`, já validado pelo `environmentSchema`. */
export function createEmailSender(config: ConfigService<Environment, true>, logger: AppLogger): EmailSender {
  const transport = config.get('EMAIL_TRANSPORT', { infer: true })
  switch (transport) {
    case 'log': return createLogEmailSender(logger)
    case 'disabled': return createDisabledEmailSender()
  }
}
