// Config mínima: só os seletores de UI que as fixtures existem para provar.
// Sem as regras type-aware, para o teste ser rápido e falhar por um motivo só.
import tseslint from 'typescript-eslint'
import { UI_RESTRICTIONS } from '../eslint/react.js'

export default tseslint.config({
  files: ['fixtures/ui/*.tsx'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  rules: {
    'no-restricted-syntax': ['error', ...UI_RESTRICTIONS],
  },
})
