const { existsSync, readFileSync } = require('node:fs')
const { dirname, join, resolve } = require('node:path')

const WORKSPACE_IMPORT = /^@habituar\/([^/]+)\/(.+)$/u

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

module.exports = {
  interfaceVersion: 2,
  resolve(source, sourceFile) {
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
  },
}
