// Regras válidas em todo workspace. O que é específico de ambiente mora nos outros
// arquivos deste diretório — regra que ajuda num pacote atrapalha em outro.
import js from '@eslint/js'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'
import importX from 'eslint-plugin-import-x'
import filenamePlugin from './filename.js'

const configPackageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const MONOREPO_ROOT = resolve(configPackageRoot, '../..')
const workspaceResolver = resolve(configPackageRoot, 'eslint/workspace-resolver.cjs')

/**
 * Fatias verticais de `apps/*\/src`, e o que cada uma pode importar das outras. A direção
 * aponta para dentro: a borda (o diretório de rotas, imposto pelo roteador) alcança todas,
 * e kit, cliente e i18n não alcançam domínio. Fatia ausente desta lista é neutra — nenhuma
 * política a menciona, então ela não restringe nem é restringida.
 */
const APP_SLICE_IMPORTS = {
  // `app` é a pasta de rotas do Expo Router; `routes`, a do TanStack Router.
  app: ['*'],
  routes: ['*'],
  authentication: ['client', 'theme', 'components', 'i18n'],
  // Espera e falha de sessão usam a moldura de entrada; nenhuma fatia de ambiente entra aqui.
  session: ['authentication', 'client', 'theme', 'components', 'i18n'],
  home: ['session', 'client', 'theme', 'components', 'i18n'],
  professional: ['session', 'client', 'theme', 'components', 'i18n'],
  theme: ['components', 'i18n'],
  client: [],
  components: ['theme', 'i18n'],
}

const APP_SLICES = Object.keys(APP_SLICE_IMPORTS)

// Micromatch: um alvo só dispensa a chave de alternativas, e `{a}` seria tratado literal.
function matchAny(names) {
  return names.length === 1 ? names[0] : `{${names.join(',')}}`
}

/** Complemento do que a fatia pode importar: é o proibido que a política precisa declarar. */
function forbiddenSlicesFor(slice) {
  const allowed = APP_SLICE_IMPORTS[slice]
  if (allowed.includes('*')) return []
  return APP_SLICES.filter((candidate) => candidate !== slice && !allowed.includes(candidate))
}

const APP_SLICE_POLICIES = APP_SLICES.flatMap((slice) => {
  const forbidden = forbiddenSlicesFor(slice)
  if (forbidden.length === 0) return []

  return [
    {
      from: { element: { captured: { slice } } },
      disallow: { to: { element: { captured: { slice: matchAny(forbidden) } } } },
      message: `A fatia ${slice} não importa {{ to.element.captured.slice }}: dependência aponta para dentro.`,
    },
  ]
})

export function boundariesSettings(rootPath = MONOREPO_ROOT) {
  return {
    'boundaries/root-path': rootPath,
    'boundaries/elements': [
      // Antes de `apps/(*)`, porque o primeiro padrão que casa é o que vale — e a fatia é
      // o elemento mais específico. O tipo continua `app` para as políticas entre
      // workspaces valerem igual dentro e fora das fatias. O segundo grupo é `(*)`, e não
      // uma alternância dos nomes conhecidos: alternância não vira captura própria, e
      // diretório que não esteja em `APP_SLICE_IMPORTS` fica neutro de qualquer forma.
      // Sem parênteses nos dois segmentos: `micromatch.capture` devolve um valor para o
      // grupo *e* outro para o curinga dentro dele, então `(*)` duplicaria a primeira
      // captura e `slice` receberia o nome do workspace.
      {
        type: 'app',
        pattern: 'apps/*/src/*',
        capture: ['workspace', 'slice'],
        partialMatch: false,
      },
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
      // As duas políticas abaixo valem só quando o import cruza workspace. A condição de
      // workspace diferente é explícita porque fatia é elemento: import entre fatias do
      // mesmo app também é `!internal`, e sem ela um `../session/x` relativo seria cobrado
      // como se fosse entrypoint público de outro pacote.
      {
        dependency: { relationship: { to: '!internal' } },
        disallow: {
          to: {
            element: { captured: { workspace: '!{{ from.element.captured.workspace }}' } },
          },
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
            element: {
              captured: { workspace: '!{{ from.element.captured.workspace }}' },
              fileInternalPath: '!src/*.{ts,tsx}',
            },
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
      ...APP_SLICE_POLICIES,
    ],
  },
]

export const EXTRANEOUS_DEPENDENCIES_RULE = ['error', { includeTypes: true }]

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
    plugins: { boundaries, 'import-x': importX, habituar: filenamePlugin },
    settings: boundariesSettings(),
    rules: {
      ...typeRules,
      'no-restricted-syntax': ['error', ...DISCIPLINE_RESTRICTIONS],
      'boundaries/dependencies': BOUNDARIES_DEPENDENCIES_RULE,
      'import-x/no-extraneous-dependencies': EXTRANEOUS_DEPENDENCIES_RULE,
      'habituar/filename-kebab-case': 'error',
    },
  },
)

export default baseConfig
