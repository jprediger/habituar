import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // O transform padrão do Vitest é esbuild, que não implementa `emitDecoratorMetadata`.
  // Sem o SWC aqui, o container do Nest não resolve nada dentro dos testes — e falha
  // sem apontar a linha.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/database/testcontainers.setup.ts'],
    // Nest e pg não gostam de threads compartilhando handles.
    pool: 'forks',
    hookTimeout: 120_000,
    // O primeiro teste de cada arquivo paga o custo de subir um Nest real a frio; a
    // suíte inteira sobe dezenas de apps reais, então o default de 5s é curto demais.
    testTimeout: 20_000,
  },
})
