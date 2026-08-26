// apps/web e apps/mobile — camada visual. Consomem os hooks de packages/core.
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import { baseConfig, DISCIPLINE_RESTRICTIONS } from './base.js'

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
      {
        selector: "JSXAttribute[name.name=/^(accessibilityLabel|aria-label)$/] > Literal",
        message: 'Texto de usuário vai por i18n, em pt-BR. Literal no componente é erro.',
      },
    ],
  },
})
