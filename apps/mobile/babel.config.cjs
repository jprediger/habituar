// CommonJS explícito pela mesma razão do metro.config.cjs: Babel (e o transform do
// jest-expo) carregam este arquivo com require(), não com import.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
  }
}
