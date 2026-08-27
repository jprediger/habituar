import tseslint from 'typescript-eslint'
import { FRAMEWORK_BANS } from '../eslint/api.js'

const LOCAL_BANS = [
  {
    group: ['drizzle-orm', 'drizzle-orm/*', 'pg', 'pg-pool'],
    message: 'Banco só é acessível pelo módulo de dados.',
  },
]

export default tseslint.config({
  files: ['fixtures/forbidden/*.ts'],
  languageOptions: { parser: tseslint.parser },
  rules: {
    'no-restricted-imports': ['error', { patterns: [...FRAMEWORK_BANS, ...LOCAL_BANS] }],
  },
})
