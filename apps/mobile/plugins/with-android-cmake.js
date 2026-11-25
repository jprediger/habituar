const { withProjectBuildGradle } = require('expo/config-plugins');

const CMAKE_VERSION = '3.31.6';
const MARKER = '// with-android-cmake';

/**
 * Dono da versão de CMake usada por todos os módulos nativos do build Android.
 * Fixa no projeto o que antes dependia do SDK de cada máquina.
 */
module.exports = function withAndroidCmake(config) {
  return withProjectBuildGradle(config, (mod) => {
    const buildGradle = mod.modResults.contents;
    if (buildGradle.includes(MARKER)) return mod;

    // O bloco precisa vir antes do plugin raiz do React Native: ele força a avaliação
    // de `:app`, e configurar o módulo depois disso não tem efeito.
    const rootPluginApply = 'apply plugin: "expo-root-project"';
    if (!buildGradle.includes(rootPluginApply)) {
      throw new Error('Could not find the Expo root project plugin in android/build.gradle');
    }

    // O ninja 1.10 do CMake 3.22.1 (padrão do React Native) ignora caminhos longos no
    // Windows e estoura o limite de 260 caracteres com os arquivos gerados pelo codegen.
    // O ninja 1.12 do CMake 3.31 respeita LongPathsEnabled. Fora do Windows é só a
    // mesma toolchain para todos; o Gradle instala a versão quando ela falta no SDK.
    const cmakeBlock = [
      MARKER,
      'subprojects {',
      "  ['com.android.application', 'com.android.library'].each { pluginId ->",
      '    plugins.withId(pluginId) {',
      `      android.externalNativeBuild.cmake.version = '${CMAKE_VERSION}'`,
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');

    mod.modResults.contents = buildGradle.replace(rootPluginApply, `${cmakeBlock}${rootPluginApply}`);
    return mod;
  });
};
