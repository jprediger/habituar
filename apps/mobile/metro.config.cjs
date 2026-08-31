// CommonJS explícito: Metro carrega este arquivo com require(), e "type": "module" no
// package.json faria um `metro.config.js` comum ser interpretado como ESM e quebrar.
const { getDefaultConfig } = require('expo/metro-config')

module.exports = getDefaultConfig(__dirname)
