import type * as ReactNative from 'react-native'

type ReactNativeModule = typeof ReactNative

// `@testing-library/react-native` já registra seus próprios matchers e a limpeza
// automática entre testes só de ser importado (ver seu `build/index.js`); este arquivo
// existe para configurações globais que ele não cobre.

// O AsyncStorage real fala com um módulo nativo que não existe no Jest; o dublê oficial
// do pacote guarda em memória e mantém a mesma API.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual<Record<string, unknown>>('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

export {}
