// Expo config plugin — adds optional hardware feature declarations to AndroidManifest.xml
// This survives every `expo prebuild --clean` run.
const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withHardwareFeatures(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    if (!manifest.manifest["uses-feature"]) {
      manifest.manifest["uses-feature"] = [];
    }

    const features = [
      "android.hardware.screen.portrait",
      "android.hardware.wifi",
    ];

    for (const name of features) {
      const already = manifest.manifest["uses-feature"].find(
        (f) => f.$?.["android:name"] === name
      );
      if (!already) {
        manifest.manifest["uses-feature"].push({
          $: { "android:name": name, "android:required": "false" },
        });
      }
    }

    return config;
  });
};
