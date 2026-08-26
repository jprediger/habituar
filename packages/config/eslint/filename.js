import { basename, extname } from 'node:path'

const KEBAB_CASE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const EXPO_ROUTE_SEGMENT = /^(?:_layout|\+[a-z0-9]+(?:-[a-z0-9]+)*|\[(?:\.\.\.)?[a-z0-9]+(?:-[a-z0-9]+)*\])$/u
const MOBILE_ROUTES_DIRECTORY = /\/apps\/mobile\/(?:src\/)?app\//u

function isValidFilename(filePath) {
  const extension = extname(filePath)
  const filename = basename(filePath, extension)
  const normalizedFilePath = filePath.replaceAll('\\', '/')

  if (MOBILE_ROUTES_DIRECTORY.test(normalizedFilePath) && EXPO_ROUTE_SEGMENT.test(filename)) {
    return true
  }

  const segments = filename.split('.')

  return segments.every((segment) => KEBAB_CASE_SEGMENT.test(segment))
}

const filenameKebabCaseRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Exige kebab-case em cada segmento de nomes de arquivos TypeScript.',
    },
    schema: [],
    messages: {
      invalid: 'Cada segmento do nome do arquivo deve usar kebab-case.',
    },
  },
  create(context) {
    return {
      Program(node) {
        const filePath = context.physicalFilename ?? context.filename

        if (!isValidFilename(filePath)) {
          context.report({ node, messageId: 'invalid' })
        }
      },
    }
  },
}

const filenamePlugin = {
  meta: { name: '@habituar/eslint-plugin-local' },
  rules: { 'filename-kebab-case': filenameKebabCaseRule },
}

export default filenamePlugin
