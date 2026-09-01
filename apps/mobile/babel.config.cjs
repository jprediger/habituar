// CommonJS explícito pela mesma razão do metro.config.cjs: Babel (e o transform do
// jest-expo) carregam este arquivo com require(), não com import.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // `@orpc/client` publica `static { ... }` (class static block) na sua build ESM. O
    // `babel-preset-expo` do SDK 54 não habilita essa sintaxe pro alvo que o Jest usa
    // (sem o `caller` do Metro/Hermes), então o parser rejeita o arquivo sem este plugin.
    plugins: ['@babel/plugin-transform-class-static-block'],
  }
}
