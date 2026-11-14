import agenda from './pt-br/agenda.json'
import common from './pt-br/common.json'
import reports from './pt-br/reports.json'

/**
 * Catálogo do app mobile: só pt-BR existe no M0 e não há seletor de idioma (decisão
 * compartilhada em `m0-clients.md`). Cada app mantém o próprio catálogo — este não é
 * reexportado para `apps/web`.
 */
export const resources = {
  // A agenda tem namespace próprio: somada ao `common`, a união de chaves passaria do
  // limite de profundidade de tipos do i18next e quebraria o `t()` tipado do app inteiro.
  'pt-BR': { common, agenda, reports },
} as const
