import { defineConfig } from 'tsup'

// As entradas espelham o mapa de `exports` do package.json. Não existe barrel: a lista
// de exports É a declaração de entrypoint público, e entrada nova entra nos dois lugares.
export default defineConfig({
  entry: {
    'contract/api-contract': 'src/contract/api-contract.ts',
    'health/health.schema': 'src/health/health.schema.ts',
    'health/health.contract': 'src/health/health.contract.ts',
  },
  // Formato único: o monorepo inteiro é ESM, então não existe condição `require` a servir.
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
})
