import type * as ReactNative from 'react-native'

type ReactNativeModule = typeof ReactNative

// `@testing-library/react-native` já registra seus próprios matchers e a limpeza
// automática entre testes só de ser importado (ver seu `build/index.js`); este arquivo
// existe para configurações globais que ele não cobre.

// O `Ionicons` carrega a própria fonte de forma assíncrona e atualiza estado quando ela
// chega — depois do corpo síncrono do teste, o que o React acusa como update fora de
// `act`. Fonte nativa não é comportamento sob teste, e o ícone é decoração escondida da
// tecnologia assistiva: o dublê preserva as props e não carrega nada.
jest.mock('@expo/vector-icons/Ionicons', () => {
  // `requireActual` dentro da fábrica, não import no topo: `jest.mock` é içado acima dos
  // imports e o módulo real precisa ser resolvido na hora da substituição.
  const reactNative = jest.requireActual<ReactNativeModule>('react-native')

  return { __esModule: true, default: reactNative.Text }
})

export {}
