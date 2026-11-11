const { withAppBuildGradle } = require('expo/config-plugins');

/** Keeps debug installations separate from the live release package. */
module.exports = function withDevAndroidApp(config) {
  return withAppBuildGradle(config, (mod) => {
    const buildGradle = mod.modResults.contents;
    if (buildGradle.includes('applicationIdSuffix ".dev"')) return mod;

    const debugBuildType = /(^\s*debug\s*\{\s*\n)(\s*signingConfig signingConfigs\.debug)/m;
    if (!debugBuildType.test(buildGradle)) {
      throw new Error('Could not find the Android debug build type');
    }

    mod.modResults.contents = buildGradle.replace(
      debugBuildType,
      '$1            applicationIdSuffix ".dev"\n            resValue "string", "app_name", "Habituar Dev"\n$2',
    );
    return mod;
  });
};
