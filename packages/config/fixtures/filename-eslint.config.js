import tseslint from 'typescript-eslint'
import filenamePlugin from '../eslint/filename.js'

export default tseslint.config({
  files: ['fixtures/filenames/**/*.{ts,tsx}'],
  languageOptions: { parser: tseslint.parser },
  plugins: { habituar: filenamePlugin },
  rules: { 'habituar/filename-kebab-case': 'error' },
})
