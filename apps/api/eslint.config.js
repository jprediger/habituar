import apiConfig, { API_SYNTAX_RESTRICTIONS, FRAMEWORK_BANS } from '@habituar/config/eslint/api'

// Camadas do backend: controller → service → repository → database. Cada recorte abaixo
// repete a lista inteira porque, no flat config, o último `no-restricted-imports` que
// casa com o arquivo substitui os anteriores em vez de somar.

const ORM_BANS = [
  {
    group: ['drizzle-orm', 'drizzle-orm/*', 'pg', 'pg-pool', '**/database/schema.js'],
    message: 'Query e tabela só existem em *.repository.ts (e em src/database/). O service recebe o repository do próprio módulo por injeção.',
  },
]

const FOREIGN_REPOSITORY_BANS = [
  {
    group: ['../**/*.repository.js'],
    message: 'Repository é privado do módulo. Outro módulo consome o service exportado, nunca a query alheia.',
  },
]

const CONTROLLER_BANS = [
  {
    group: ['**/database/*', './*.repository.js'],
    message: 'Controller é borda: fala com o service do módulo, nunca com banco ou repository.',
  },
]

const REPOSITORY_BANS = [
  {
    group: ['./*.service.js', './*.controller.js', '../**/*.service.js', '../**/*.controller.js'],
    message: 'Repository não conhece regra nem borda: recebe a transação e devolve dados.',
  },
]

// O import de `drizzle-orm` já é barrado fora do repository, mas `transaction.query.x.findFirst({ where: (t, { eq }) => … })`
// dispensa import. O seletor depende do nome do parâmetro, que é o nome usado em todo `Database.with*`.
const TRANSACTION_ACCESS_BAN = {
  selector: "MemberExpression[object.name='transaction'][property.name=/^(query|select|insert|update|delete|execute)$/]",
  message: 'Acesso ao banco é do repository. O service decide a regra e chama o repository com a transação.',
}

export default [
  { ignores: ['dist'] },
  ...apiConfig,
  {
    files: ['src/**/*.ts'],
    ignores: ['src/database/**/*.ts', 'src/**/*.repository.ts', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...FRAMEWORK_BANS, ...ORM_BANS, ...FOREIGN_REPOSITORY_BANS] }],
      'no-restricted-syntax': ['error', ...API_SYNTAX_RESTRICTIONS, TRANSACTION_ACCESS_BAN],
    },
  },
  {
    files: ['src/**/*.controller.ts', 'src/**/*.guard.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...FRAMEWORK_BANS, ...ORM_BANS, ...FOREIGN_REPOSITORY_BANS, ...CONTROLLER_BANS] }],
    },
  },
  {
    files: ['src/**/*.repository.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...FRAMEWORK_BANS, ...FOREIGN_REPOSITORY_BANS, ...REPOSITORY_BANS] }],
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
]
