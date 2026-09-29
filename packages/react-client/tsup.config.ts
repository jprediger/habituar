import { defineConfig } from 'tsup'

// Uma entrada por entrypoint público: a lista de exports do package.json É a declaração
// de entrypoint — não existe barrel, e nenhum arquivo fora desta lista é importável.
export default defineConfig({
  entry: {
    'react-client': 'src/react-client.ts',
    form: 'src/form.ts',
    'login-form': 'src/login-form.ts',
    'environment-navigation': 'src/environment-navigation.ts',
    'platform-forms': 'src/platform-forms.ts',
    'invitation-acceptance': 'src/invitation-acceptance.ts',
    'staff-management': 'src/staff-management.ts',
  },
  // Formato único: o monorepo inteiro é ESM, então não existe condição `require` a servir.
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
})
