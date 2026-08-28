import common from './pt-br/common.json'

/**
 * Único idioma do catálogo (M0). Fonte de tipos do `t()` tipado do app inteiro — chave
 * inexistente ou com typo vira erro de build, não texto em branco em produção.
 */
export const resources = {
  'pt-BR': { common },
} as const
