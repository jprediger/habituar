// Config mínima: só as regras de import que a fixture existe para provar.
// Sem as regras type-aware, para o teste ser rápido e falhar por um motivo só.
import tseslint from 'typescript-eslint'
import { LEAK_BANS, SHARED_RESTRICTIONS } from '../eslint/shared-package.js'

export default tseslint.config(
  {
    files: ['fixtures/forbidden/*.ts'],
    languageOptions: { parser: tseslint.parser },
    rules: {
      'no-restricted-imports': ['error', { patterns: LEAK_BANS }],
      'no-restricted-syntax': ['error', ...SHARED_RESTRICTIONS],
    },
  },
)
