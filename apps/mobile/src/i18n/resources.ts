import common from './pt-br/common.json'

/**
 * Catálogo do app mobile: só pt-BR existe no M0 e não há seletor de idioma (decisão
 * compartilhada em `m0-clients.md`). Cada app mantém o próprio catálogo — este não é
 * reexportado para `apps/web`.
 */
export const resources = {
  'pt-BR': { common },
} as const
