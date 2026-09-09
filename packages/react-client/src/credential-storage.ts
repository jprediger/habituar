/** Porta mínima para a credencial Bearer do mobile; a implementação decide o armazenamento seguro. */
export type CredentialStorage = Readonly<{
  read(): Promise<string | undefined>
  write(token: string): Promise<void>
  remove(): Promise<void>
}>

/** Armazenamento efêmero para testes de comportamento da porta de credencial. */
export function createMemoryCredentialStorage(): CredentialStorage {
  let token: string | undefined

  return {
    read(): Promise<string | undefined> {
      return Promise.resolve(token)
    },
    write(value: string): Promise<void> {
      token = value
      return Promise.resolve()
    },
    remove(): Promise<void> {
      token = undefined
      return Promise.resolve()
    },
  }
}
