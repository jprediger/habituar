import reactConfig from '@habituar/config/eslint/react'

export default [
  { ignores: ['dist', 'src/route-tree.gen.ts'] },
  ...reactConfig,
  {
    // `__root.tsx` é o nome exigido pela convenção de roteamento por arquivo do TanStack
    // Router (como `_layout`/`[id]` já são para o Expo Router do mobile) — não kebab-case
    // por escolha, mas por contrato do framework. Só a regra de nome relaxa; o resto do
    // lint continua valendo para o arquivo.
    files: ['src/routes/__root.tsx'],
    rules: {
      'habituar/filename-kebab-case': 'off',
    },
  },
]
