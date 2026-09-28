import type { PreferenceStorage } from '@habituar/react-client/react-client'

const KEY = 'habituar.last-institution'

/** Preferência opcional: navegador sem armazenamento continua permitindo a troca. */
export const institutionPreferenceStorage: PreferenceStorage = {
  read() {
    try { return Promise.resolve(localStorage.getItem(KEY) ?? undefined) }
    catch { return Promise.resolve(undefined) }
  },
  write(value) {
    try { localStorage.setItem(KEY, value) }
    catch { return Promise.resolve() }
    return Promise.resolve()
  },
  remove() {
    try { localStorage.removeItem(KEY) }
    catch { return Promise.resolve() }
    return Promise.resolve()
  },
}
