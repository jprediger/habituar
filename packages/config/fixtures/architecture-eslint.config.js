// A fixture usa o plugin real e a política exportada por produção. A única diferença
// arquitetural é a raiz em que apps/* e packages/* são procurados.
import { resolve } from 'node:path'
import boundaries from 'eslint-plugin-boundaries'
import importX from 'eslint-plugin-import-x'
import tseslint from 'typescript-eslint'
import {
  BOUNDARIES_DEPENDENCIES_RULE,
  EXTRANEOUS_DEPENDENCIES_RULE,
  boundariesSettings,
} from '../eslint/base.js'

const fixtureRoot = resolve(import.meta.dirname, 'architecture')

export default tseslint.config({
  files: ['fixtures/architecture/{apps,packages}/**/*.{ts,tsx}'],
  languageOptions: { parser: tseslint.parser },
  plugins: { boundaries, 'import-x': importX },
  settings: {
    ...boundariesSettings(),
    'boundaries/root-path': fixtureRoot,
  },
  rules: {
    'boundaries/dependencies': BOUNDARIES_DEPENDENCIES_RULE,
    'import-x/no-extraneous-dependencies': EXTRANEOUS_DEPENDENCIES_RULE,
  },
})
