import apiConfig, { FRAMEWORK_BANS } from '@habituar/config/eslint/api'

const ORM_BANS = [
  {
    group: ['drizzle-orm', 'drizzle-orm/*', 'pg', 'pg-pool'],
    message: 'Banco só é acessível por src/database/ e toda operação passa por withTenant().',
  },
]

export default [
  { ignores: ['dist'] },
  ...apiConfig,
  {
    files: ['src/**/*.ts'],
    ignores: ['src/database/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...FRAMEWORK_BANS, ...ORM_BANS] }],
    },
  },
]
