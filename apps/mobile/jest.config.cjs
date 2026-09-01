// CommonJS explícito pela mesma razão do metro.config.cjs: Jest carrega este arquivo com
// require(), não com import.
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // `@orpc/*` só publica ESM (sem condição `require`); sem transformar, o `require()` do
  // Jest não entende `import`/`export` no arquivo. Mantém o resto da lista padrão do
  // `jest-expo` (ver seu `jest-preset.js`) e só acrescenta `@orpc`.
  transform: {
    // `@orpc/*` publica `.mjs`; sem esta entrada nenhum transform bate nessa extensão e o
    // arquivo passa cru pro `require()` do Jest. O `caller` replica o que o próprio
    // `jest-expo` passa pra entrada `.[jt]sx?`: sem ele o `babel-preset-expo` não sabe que
    // o alvo é o Hermes e não habilita a sintaxe de static class block que o `@orpc/client`
    // usa, quebrando o parse.
    '\\.mjs$': ['babel-jest', { caller: { name: 'metro', bundler: 'metro', platform: 'ios' } }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@orpc))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  // `@habituar/core`, `@habituar/design-tokens` e `@habituar/react-client` só publicam
  // `dist` em ESM puro (sem condição `require`), e Jest resolve módulos por CommonJS.
  // Mapeia direto para a fonte: Babel já transforma TS/ESM do próprio app, então também
  // transforma a fonte desses pacotes sem exigir build prévio para rodar os testes.
  moduleNameMapper: {
    // A fonte desses pacotes importa vizinhos pela extensão emitida (`./x.js`) porque é
    // isso que existirá depois do build; sem build, o `.ts` real é o que existe no disco.
    '^(\\.{1,2}/.+)\\.js$': '$1',
    '^@habituar/core/assert-never$': '<rootDir>/../../packages/core/src/type/assert-never.ts',
    '^@habituar/core/contract$': '<rootDir>/../../packages/core/src/contract/api-contract.ts',
    '^@habituar/core/health/schema$': '<rootDir>/../../packages/core/src/health/health.schema.ts',
    '^@habituar/design-tokens/interaction$': '<rootDir>/../../packages/design-tokens/src/interaction.ts',
    '^@habituar/design-tokens/semantic-color$': '<rootDir>/../../packages/design-tokens/src/semantic-color.ts',
    '^@habituar/design-tokens/spacing$': '<rootDir>/../../packages/design-tokens/src/spacing.ts',
    '^@habituar/react-client/react-client$': '<rootDir>/../../packages/react-client/src/react-client.ts',
  },
}
