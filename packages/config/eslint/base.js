// Regras válidas em todo workspace. O que é específico de ambiente mora nos outros
// arquivos deste diretório — regra que ajuda num pacote atrapalha em outro.
import js from '@eslint/js'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'
import filenamePlugin from './filename.js'

const configPackageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const MONOREPO_ROOT = resolve(configPackageRoot, '../..')
const workspaceResolver = resolve(configPackageRoot, 'eslint/workspace-resolver.cjs')

export function boundariesSettings(rootPath = MONOREPO_ROOT) {
  return {
    'boundaries/root-path': rootPath,
    'boundaries/elements': [
      {
        type: 'app',
        pattern: 'apps/(*)',
        capture: ['workspace'],
        partialMatch: false,
      },
      {
        type: 'package',
        pattern: 'packages/(*)',
        capture: ['workspace'],
        partialMatch: false,
      },
    ],
    'boundaries/legacy-templates': false,
    'import/resolver': {
      [workspaceResolver]: {},
      node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
    },
  }
}

export const BOUNDARIES_DEPENDENCIES_RULE = [
  'error',
  {
    default: 'allow',
    checkAllOrigins: true,
    checkUnknownLocals: true,
    checkInternals: true,
    policies: [
      {
        disallow: {
          to: {
            element: { isUnknown: true },
            module: { origin: 'local' },
          },
        },
        message: 'Todo alvo local precisa pertencer a apps/* ou packages/*.',
      },
      {
        dependency: { relationship: { to: '!internal' } },
        disallow: {
          dependency: {
            source: '!@habituar/{{ to.element.captured.workspace }}/*',
          },
        },
        message: 'Imports entre workspaces usam @habituar/<workspace>/<subpath>.',
      },
      {
        dependency: { relationship: { to: '!internal' } },
        disallow: {
          to: {
            element: { fileInternalPath: '!src/*.{ts,tsx}' },
          },
        },
        message: 'Entrypoints públicos ficam no primeiro nível de src.',
      },
      {
        disallow: {
          to: {
            element: { isUnknown: true },
            module: { origin: 'external' },
          },
          dependency: { source: '@habituar/**' },
        },
        message: 'Workspace ou subpath @habituar desconhecido ou não exportado.',
      },
      {
        from: { element: { type: 'package' } },
        disallow: { to: { element: { type: 'app' } } },
        message: 'packages/* não pode depender de apps/*.',
      },
      {
        from: { element: { type: 'app' } },
        disallow: {
          to: {
            element: {
              type: 'app',
              captured: { workspace: '!{{ from.element.captured.workspace }}' },
            },
          },
        },
        message: 'Um app não pode depender de outro app.',
      },
    ],
  },
]

/** Estado é união discriminada, efeito é injetado, entrada desconhecida passa por parse. */
export const typeRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  // `as` proibido: entrada desconhecida é `unknown` e passa por parse.
  '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
  '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' }],
  // Variante nova de união precisa quebrar o build em cada ponto que precisa saber dela.
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  'no-empty': ['error', { allowEmptyCatch: false }],
}

/** Tempo e aleatoriedade são portas; papel não se compara por string. */
export const DISCIPLINE_RESTRICTIONS = [
  {
    selector: "NewExpression[callee.name='Date']",
    message: 'Tempo é porta injetada (Clock). Código que não controla o tempo não tem teste de tempo.',
  },
  {
    selector: "MemberExpression[object.name='Math'][property.name='random']",
    message: 'Aleatoriedade é porta injetada (IdGenerator).',
  },
  {
    selector: "BinaryExpression[operator=/^[!=]==?$/][left.property.name='role']",
    message: 'Autorização tem um único call site. Comparar papel por string é erro (D9).',
  },
]

export const baseConfig = tseslint.config(
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    plugins: { boundaries, habituar: filenamePlugin },
    settings: boundariesSettings(),
    rules: {
      ...typeRules,
      'no-restricted-syntax': ['error', ...DISCIPLINE_RESTRICTIONS],
      'boundaries/dependencies': BOUNDARIES_DEPENDENCIES_RULE,
      'habituar/filename-kebab-case': 'error',
    },
  },
)

export default baseConfig
