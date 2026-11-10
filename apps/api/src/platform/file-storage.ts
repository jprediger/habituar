import { ConfigService } from '@nestjs/config'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { Environment } from '../environment/environment.schema.js'

/**
 * Porta de armazenamento de arquivos enviados por usuários. O banco guarda só a chave;
 * trocar disco local por armazenamento de objetos é trocar o adaptador, não o chamador.
 */
export type FileStorage = Readonly<{
  put(key: string, content: Uint8Array): Promise<void>
  read(key: string): Promise<Uint8Array>
  remove(key: string): Promise<void>
}>

export const FILE_STORAGE = Symbol('FileStorage')

/** Adaptador de disco local, recusando chave que escape do diretório configurado. */
export function createLocalDiskFileStorage(directory: string): FileStorage {
  const root = resolve(directory)
  // Chave vem do próprio servidor, mas o adaptador não confia nisso: `..` aqui seria
  // leitura de qualquer arquivo do processo.
  function locate(key: string): string {
    const path = resolve(root, key)
    if (!path.startsWith(root + sep)) throw new Error('Storage key escapes the storage directory')
    return path
  }
  return {
    async put(key, content) {
      const path = locate(key)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, content, { flag: 'wx' })
    },
    async read(key) {
      return new Uint8Array(await readFile(locate(key)))
    },
    async remove(key) {
      await rm(locate(key), { force: true })
    },
  }
}

/** Adaptador em memória para testes, com a mesma recusa de sobrescrita do disco. */
export function createInMemoryFileStorage(): FileStorage & Readonly<{ keys(): readonly string[] }> {
  const files = new Map<string, Uint8Array>()
  return {
    put(key, content) {
      if (files.has(key)) return Promise.reject(new Error('Storage key already exists'))
      files.set(key, content)
      return Promise.resolve()
    },
    read(key) {
      const content = files.get(key)
      return content === undefined ? Promise.reject(new Error('Storage key not found')) : Promise.resolve(content)
    },
    remove(key) {
      files.delete(key)
      return Promise.resolve()
    },
    keys: () => [...files.keys()],
  }
}

/** Escolhe o adaptador a partir da configuração validada no boot. */
export function createFileStorage(config: ConfigService<Environment, true>): FileStorage {
  return createLocalDiskFileStorage(config.get('FILE_STORAGE_DIRECTORY', { infer: true }))
}
