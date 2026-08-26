// packages/* — código compartilhado. Sem framework, sem UI, sem plataforma.
// A garantia de primeira linha é a dependência não declarada no package.json; com
// `nodeLinker: hoisted` (previsto no D5 para o Expo) isso deixa de valer, e estas
// regras passam a ser a única proteção.
import tseslint from 'typescript-eslint'
import { baseConfig, DISCIPLINE_RESTRICTIONS } from './base.js'

export const LEAK_BANS = [
  {
    group: ['@nestjs/*', 'reflect-metadata', 'class-validator', 'class-transformer'],
    message: 'Domínio não importa framework. A borda importa o domínio, nunca o contrário.',
  },
  {
    group: ['react-native', 'react-native/*', 'expo', 'expo-*'],
    message: 'Pacote compartilhado não tem referência visual nem de plataforma (D2).',
  },
  {
    group: ['drizzle-orm', 'drizzle-orm/*', 'pg', 'postgres'],
    message: 'Um único caminho até o banco, e ele vive em apps/api.',
  },
  {
    group: ['@habituar/api', '@habituar/api/*'],
    message: 'packages/* não importa de apps/*. O contrato mora aqui; é a API que depende dele (D4).',
  },
]

export const SHARED_RESTRICTIONS = [
  ...DISCIPLINE_RESTRICTIONS,
  {
    selector: 'ClassDeclaration > Decorator',
    message: 'Decorator de classe pertence à borda do framework, nunca ao pacote compartilhado.',
  },
]

export default tseslint.config(...baseConfig, {
  files: ['**/*.ts', '**/*.tsx'],
  plugins: { '@typescript-eslint': tseslint.plugin },
  rules: {
    'no-restricted-imports': ['error', { patterns: LEAK_BANS }],
    'no-restricted-syntax': ['error', ...SHARED_RESTRICTIONS],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
  },
})
