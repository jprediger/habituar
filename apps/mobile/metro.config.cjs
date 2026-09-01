// CommonJS explícito: Metro carrega este arquivo com require(), e "type": "module" no
// package.json faria um `metro.config.js` comum ser interpretado como ESM e quebrar.
const { getDefaultConfig } = require('expo/metro-config')
const exclusionList = require('metro-config/private/defaults/exclusionList').default

const config = getDefaultConfig(__dirname)

// O require.context do expo-router (node_modules/expo-router/_ctx.*.js) só exclui
// +api/+html/+middleware — arquivo de teste colocado em src/app vira rota e entra no
// bundle nativo, puxando @testing-library/react-native (que importa o módulo "console"
// do Node e quebra no runtime do Hermes).
config.resolver.blockList = exclusionList([/\.test\.[jt]sx?$/, ...[config.resolver.blockList].flat()])

module.exports = config
