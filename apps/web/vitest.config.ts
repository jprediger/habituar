import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@habituar/core/assert-never': fileURLToPath(new URL('../../packages/core/src/type/assert-never.ts', import.meta.url)),
      '@habituar/core/auth/context': fileURLToPath(new URL('../../packages/core/src/auth/auth-context.ts', import.meta.url)),
      '@habituar/core/home-destination': fileURLToPath(new URL('../../packages/core/src/home-destination.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
