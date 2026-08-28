import { defineConfig } from 'tsup'

// As entradas espelham o mapa de `exports` do package.json. Não existe barrel: a lista
// de exports É a declaração de entrypoint público, e entrada nova entra nos dois lugares.
// `contrast-pair` fica de fora de propósito: CONTRAST_PAIRS só tem consumidor dentro do
// próprio pacote (o teste de contraste e o gerador de CSS), não é entrypoint público.
export default defineConfig({
  entry: {
    color: 'src/color.ts',
    'semantic-color': 'src/semantic-color.ts',
    spacing: 'src/spacing.ts',
    interaction: 'src/interaction.ts',
    typography: 'src/typography.ts',
    contrast: 'src/contrast.ts',
  },
  // Formato único: o monorepo inteiro é ESM, então não existe condição `require` a servir.
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
})
