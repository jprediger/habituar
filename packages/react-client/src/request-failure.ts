/**
 * Leitura de falha de requisição por código do catálogo fechado, nunca pelo texto do erro.
 * Interno ao pacote: cada hook decide o que o código significa para a própria tela.
 * Narrowing via `in` sobre `object` (sem `as`) — suportado desde TS 4.9.
 */
export function readFailureCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return undefined
}

/**
 * `fetch` só rejeita sem status quando a requisição não completou; com status, o servidor
 * respondeu. Repetir uma resposta do servidor (403, 404, 409) não muda o resultado.
 */
export function hasServerResponse(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
}

/**
 * Decide se a falha de uma query derruba a tela. Sem conexão, o dado que já está no cache
 * (inclusive o reposto do disco) continua valendo; resposta do servidor sempre derruba.
 */
export function isBlockingFailure(query: Readonly<{ isError: boolean; error: unknown; data: unknown }>): boolean {
  return query.isError && (query.data === undefined || hasServerResponse(query.error))
}
