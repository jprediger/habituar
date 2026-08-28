import { fileURLToPath, URL } from 'node:url'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// O router-plugin gera `route-tree.gen.ts` antes do plugin de React ver os arquivos —
// por isso a ordem dos plugins importa (docs do TanStack Router).
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/route-tree.gen.ts',
      routeFileIgnorePattern: '\\.test\\.tsx$',
    }),
    react(),
    tailwindcss(),
  ],
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
