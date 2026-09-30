import type { PreferenceStorage } from '@habituar/react-client/react-client'

const KEY = 'habituar.last-student'

/** Preferência do aluno representado, local ao navegador e isolada da instituição ativa. */
export const studentPreferenceStorage: PreferenceStorage = {
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
