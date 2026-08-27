// Único arquivo CommonJS do monorepo, e por obrigação: a interface de resolver do
// eslint-plugin-import é carregada por `require`, não por import.
const { existsSync, readFileSync } = require('node:fs')
const { dirname, join, resolve } = require('node:path')

const WORKSPACE_IMPORT = /^@habituar\/([^/]+)\/(.+)$/u
const RELATIVE_EMITTED_IMPORT = /^\.{1,2}\/.*\.(?<extension>js|mjs|cjs)$/u

// Sob ESM, o import relativo cita a extensão do arquivo EMITIDO (`./x.js`), mas o que
// existe no disco é o fonte (`./x.ts`). Sem este mapeamento o alvo local não resolve e
// o `boundaries` acusa alvo desconhecido em todo import interno de apps/api.
const SOURCE_EXTENSIONS = {
  js: ['.ts', '.tsx', '.js', '.jsx'],
  mjs: ['.mts', '.mjs'],
  cjs: ['.cts', '.cjs'],
}

function exportedTarget(manifest, subpath) {
  const value = manifest.exports?.[`./${subpath}`]

  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object') {
    return value.import ?? value.default
  }

  return undefined
}

function findWorkspaceRoot(sourceFile, workspace) {
  let current = dirname(sourceFile)

  while (true) {
    for (const group of ['apps', 'packages']) {
      const packageRoot = join(current, group, workspace)

      if (existsSync(join(packageRoot, 'package.json'))) {
        return packageRoot
      }
    }

    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

function resolveEmittedRelative(source, sourceFile) {
  const extension = RELATIVE_EMITTED_IMPORT.exec(source)?.groups?.extension
  if (!extension) return { found: false }

  const withoutExtension = resolve(dirname(sourceFile), source).slice(0, -(extension.length + 1))

  for (const candidate of SOURCE_EXTENSIONS[extension]) {
    const targetPath = `${withoutExtension}${candidate}`
    if (existsSync(targetPath)) return { found: true, path: targetPath }
  }

  return { found: false }
}

function resolveWorkspace(source, sourceFile) {
  const match = WORKSPACE_IMPORT.exec(source)
  if (!match) return { found: false }

  const [, workspace, subpath] = match
  const packageRoot = findWorkspaceRoot(sourceFile, workspace)
  if (!packageRoot) return { found: false }

  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  const target = exportedTarget(manifest, subpath)
  if (!target) return { found: false }

  const targetPath = resolve(packageRoot, target)
  return existsSync(targetPath) ? { found: true, path: targetPath } : { found: false }
}

module.exports = {
  interfaceVersion: 2,
  resolve(source, sourceFile) {
    const workspaceResult = resolveWorkspace(source, sourceFile)
    if (workspaceResult.found) return workspaceResult

    return resolveEmittedRelative(source, sourceFile)
  },
}
