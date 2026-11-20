// Expo config plugin — Google Play compliance. Runs on every `expo prebuild`.
//  • Marks Wi-Fi, portrait screen and camera as OPTIONAL so the app installs on
//    tablets, Chromebooks and other devices that lack them.
//  • Removes the advertising-ID permission, because the app shows no ads.
const { withAndroidManifest } = require("expo/config-plugins");

const OPTIONAL_FEATURES = [
  "android.hardware.screen.portrait",
  "android.hardware.wifi",
  "android.hardware.camera",
  "android.hardware.camera.any",
  "android.hardware.camera.autofocus",
];
const AD_ID = "com.google.android.gms.permission.AD_ID";

module.exports = function withHardwareFeatures(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] =
      manifest.$["xmlns:tools"] || "http://schemas.android.com/tools";

    manifest["uses-feature"] = manifest["uses-feature"] || [];
    for (const name of OPTIONAL_FEATURES) {
      const existing = manifest["uses-feature"].find(
        (f) => f.$ && f.$["android:name"] === name,
      );
      if (existing) existing.$["android:required"] = "false";
      else
        manifest["uses-feature"].push({
          $: { "android:name": name, "android:required": "false" },
        });
    }

    manifest["uses-permission"] = (manifest["uses-permission"] || []).filter(
      (p) => !(p.$ && p.$["android:name"] === AD_ID),
    );
    manifest["uses-permission"].push({
      $: { "android:name": AD_ID, "tools:node": "remove" },
    });

    return config;
  });
};
