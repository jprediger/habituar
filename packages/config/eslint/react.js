// apps/web e apps/mobile — camada visual. Consomem os hooks de packages/react-client.
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import { baseConfig, DISCIPLINE_RESTRICTIONS } from './base.js'

// Exportado porque as fixtures do teste precisam da mesma lista: regra provada por
// fixture é garantia, regra só declarada é crença.
export const UI_RESTRICTIONS = [
  {
    // JSXText com qualquer caractere não branco. Quebra de linha e indentação entre
    // elementos também são JSXText, e essas continuam permitidas.
    selector: 'JSXText[value=/[^\\s]/]',
    message: 'Texto de usuário vai por i18n, em pt-BR. Literal dentro do componente é erro.',
  },
  {
    selector:
      "JSXAttribute[name.name=/^(accessibilityLabel|accessibilityHint|aria-label|aria-description|placeholder|title|alt)$/] > Literal",
    message: 'Rótulo e texto acessível também vêm de i18n. Literal no atributo é erro.',
  },
  {
    // Duas formas do mesmo defeito: no RN, o toque sem papel declarado; no web, o
    // handler pendurado em elemento que não é interativo por natureza.
    selector:
      "JSXOpeningElement[name.name=/^(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback)$/]:not(:has(JSXAttribute[name.name='accessibilityRole'])), JSXOpeningElement[name.name=/^(div|span|section|article|li|td|p)$/]:has(JSXAttribute[name.name=/^on(Click|KeyDown|Press)$/])",
    message:
      'Elemento interativo declara papel: use o elemento nativo interativo ou declare accessibilityRole.',
  },
]

export default tseslint.config(...baseConfig, {
  files: ['**/*.ts', '**/*.tsx'],
  plugins: {
    '@typescript-eslint': tseslint.plugin,
    'react-hooks': reactHooks,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    'no-restricted-syntax': [
      'error',
      ...DISCIPLINE_RESTRICTIONS,
      {
        // Aproximação: pega o caso comum. Estado de servidor pertence à camada de
        // data fetching, e não existe cache paralelo.
        selector: "CallExpression[callee.name='useEffect'] CallExpression[callee.name='fetch']",
        message: 'useEffect para buscar dados é proibido. Use a camada de data fetching.',
      },
      ...UI_RESTRICTIONS,
    ],
  },
})
