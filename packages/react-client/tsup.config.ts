import { defineConfig } from 'tsup'

// Uma única entrada: `react-client.ts` é o único arquivo público do pacote, e a lista de
// exports do package.json É a declaração de entrypoint — não existe barrel.
export default defineConfig({
  entry: {
    'react-client': 'src/react-client.ts',
  },
  // Formato único: o monorepo inteiro é ESM, então não existe condição `require` a servir.
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
})
