import { defineConfig } from 'tsup'

// Uma entrada por entrypoint público: a lista de exports do package.json É a declaração
// de entrypoint — não existe barrel, e nenhum arquivo fora desta lista é importável.
export default defineConfig({
  entry: {
    'react-client': 'src/react-client.ts',
    form: 'src/form.ts',
  },
  // Formato único: o monorepo inteiro é ESM, então não existe condição `require` a servir.
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
})
