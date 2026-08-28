import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Único ambiente onde a origem da SPA e a da API divergem (D-clients): em
      // homologação/produção a mesma origem pública já serve as duas.
      '/v1': 'http://localhost:3000',
    },
  },
})
