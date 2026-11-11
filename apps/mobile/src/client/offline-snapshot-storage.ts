import AsyncStorage from '@react-native-async-storage/async-storage'
import type { OfflineStorage } from '@habituar/react-client/react-client'

const KEY = 'habituar.offline-snapshot'

/**
 * Cópia sem conexão da agenda do aluno e da fila de mudanças. Fica no AsyncStorage, que já
 * está no app: o volume (rotina, registros, fila) não justifica um módulo nativo novo, e o
 * conteúdo sai do aparelho quando a sessão termina.
 */
export const offlineSnapshotStorage: OfflineStorage = {
  read: async () => (await AsyncStorage.getItem(KEY)) ?? undefined,
  write: (value) => AsyncStorage.setItem(KEY, value),
  remove: () => AsyncStorage.removeItem(KEY),
}
