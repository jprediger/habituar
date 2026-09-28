/** Guarda somente a última instituição; não armazena credenciais nem concede acesso. */
export type PreferenceStorage = Readonly<{
  read(): Promise<string | undefined>
  write(institutionId: string): Promise<void>
  remove(): Promise<void>
}>

/** Preferência efêmera para consumidores sem persistência e testes de sessão. */
export function createMemoryPreferenceStorage(): PreferenceStorage {
  let value: string | undefined
  return {
    read: () => Promise.resolve(value),
    write: (next) => { value = next; return Promise.resolve() },
    remove: () => { value = undefined; return Promise.resolve() },
  }
}
