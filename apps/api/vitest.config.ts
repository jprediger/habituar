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
  },
})
