// apps/api — NestJS. É o único workspace onde decorator e DI existem.
import tseslint from 'typescript-eslint'
import { baseConfig, DISCIPLINE_RESTRICTIONS } from './base.js'

const FRAMEWORK_BANS = [
  {
    group: ['class-validator', 'class-transformer'],
    message: 'Validação é zod, no contrato em packages/core. DTO com class-validator seria uma segunda definição de validade (D4).',
  },
]

export default tseslint.config(...baseConfig, {
  files: ['**/*.ts', '**/*.tsx'],
  plugins: { '@typescript-eslint': tseslint.plugin },
  rules: {
    'no-restricted-imports': ['error', { patterns: FRAMEWORK_BANS }],

    // `import type` de uma classe injetada apaga a metadata que o container lê em
    // runtime, e o Nest falha sem apontar a linha. Aqui o autofixer trabalha ao contrário.
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'no-type-imports' }],

    // Classe vazia continua sendo erro, menos quando existe por causa do decorator:
    // módulo do Nest é declaração de grafo, não classe com comportamento.
    '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],

    'no-restricted-syntax': [
      'error',
      ...DISCIPLINE_RESTRICTIONS,
      {
        selector: "CallExpression[callee.name='forwardRef']",
        message: 'Ciclo entre módulos é erro de desenho: ou são um só, ou falta um terceiro.',
      },
      {
        selector: 'ClassDeclaration[superClass]:not([superClass.name=/(Error|Exception)$/])',
        message: 'Herança entre providers é proibida. Reuso é composição por injeção.',
      },
    ],
  },
})
