import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import sharedPackageConfig from './eslint/shared-package.js'

export default tseslint.config(
  {
    ignores: ['**/fixtures/**/*.ts', '**/fixtures/**/*.tsx'],
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    extends: [js.configs.recommended],
  },
  ...sharedPackageConfig,
)
