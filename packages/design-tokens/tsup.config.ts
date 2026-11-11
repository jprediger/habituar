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
    radius: 'src/radius.ts',
    interaction: 'src/interaction.ts',
    typography: 'src/typography.ts',
    contrast: 'src/contrast.ts',
  },
  // Formato único: o monorepo inteiro é ESM, então não existe condição `require` a servir.
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  // Sem limpar a pasta: o Metro do app lê `dist` enquanto roda, e apagá-la no meio do build
  // deixa o bundler sem o módulo até reiniciar com cache limpo. Limpeza é o script `clean`.
  clean: false,
  target: 'es2022',
})
