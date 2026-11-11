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
    'student-record-navigation': 'src/student-record-navigation.ts',
    'student-record-forms': 'src/student-record-forms.ts',
    'routine-forms': 'src/routine-forms.ts',
    'agenda-forms': 'src/agenda-forms.ts',
    'task-forms': 'src/task-forms.ts',
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
