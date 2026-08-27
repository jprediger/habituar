/** Variante nova de união quebra o build em cada `switch` que precisa saber dela. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected variant: ${JSON.stringify(value)}`)
}
