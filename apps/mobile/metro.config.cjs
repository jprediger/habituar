// CommonJS explícito: Metro carrega este arquivo com require(), e "type": "module" no
// package.json faria um `metro.config.js` comum ser interpretado como ESM e quebrar.
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// O require.context do expo-router (node_modules/expo-router/_ctx.*.js) só exclui
// +api/+html/+middleware — arquivo de teste colocado em src/app vira rota e entra no
// bundle nativo, puxando @testing-library/react-native (que importa o módulo "console"
// do Node e quebra no runtime do Hermes).
// Lista em vez de `exclusionList`: o padrão do Expo já vem com o separador do sistema, e
// reescapá-lo troca `/` por `\` de novo, gerando regex inválida no Windows.
config.resolver.blockList = [/\.test\.[jt]sx?$/, ...[config.resolver.blockList].flat()]

module.exports = config
