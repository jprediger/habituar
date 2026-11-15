import agenda from './pt-br/agenda.json'
import common from './pt-br/common.json'
import reports from './pt-br/reports.json'
import classes from './pt-br/classes.json'

/**
 * Único idioma do catálogo (M0). Fonte de tipos do `t()` tipado do app inteiro — chave
 * inexistente ou com typo vira erro de build, não texto em branco em produção.
 */
export const resources = {
  // A agenda tem namespace próprio: somada ao `common`, a união de chaves passaria do
  // limite de profundidade de tipos do i18next e quebraria o `t()` tipado do app inteiro.
  'pt-BR': { common, agenda, reports, classes },
} as const
