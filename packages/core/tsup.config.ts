import { defineConfig } from 'tsup'

// As entradas espelham o mapa de `exports` do package.json. Não existe barrel: a lista
// de exports É a declaração de entrypoint público, e entrada nova entra nos dois lugares.
export default defineConfig({
  entry: {
    'type/assert-never': 'src/type/assert-never.ts',
    'identity/branded-id': 'src/identity/branded-id.ts',
    'contract/api-contract': 'src/contract/api-contract.ts',
    'contract/failure': 'src/contract/failure.ts',
    'health/health.schema': 'src/health/health.schema.ts',
    'health/health.contract': 'src/health/health.contract.ts',
    'identity/ids': 'src/identity/ids.ts',
    'permissions/permission-catalog': 'src/permissions/permission-catalog.ts',
    roles: 'src/roles.ts',
    'home-destination': 'src/home-destination.ts',
    'auth/auth.schema': 'src/auth/auth.schema.ts',
    'auth/auth-context': 'src/auth/auth-context.ts',
    'auth/auth.contract': 'src/auth/auth.contract.ts',
  },
  // Formato único: o monorepo inteiro é ESM, então não existe condição `require` a servir.
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
})
