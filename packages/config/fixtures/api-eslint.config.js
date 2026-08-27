import tseslint from 'typescript-eslint'
import { FRAMEWORK_BANS } from '../eslint/api.js'

const LOCAL_BANS = [
  {
    group: ['example-local-package'],
    message: 'Restrição local de exemplo.',
  },
]

export default tseslint.config({
  files: ['fixtures/forbidden/class-validator-in-api.ts'],
  languageOptions: { parser: tseslint.parser },
  rules: {
    'no-restricted-imports': ['error', { patterns: [...FRAMEWORK_BANS, ...LOCAL_BANS] }],
  },
})
