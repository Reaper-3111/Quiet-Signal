const { withGradleProperties, withSettingsGradle } = require('expo/config-plugins');

/**
 * Adds the Wear OS tile app (targets/wear) to the Android build as module ':wear'. It must have the
 * same application id and signing key as the phone app for the Wearable Data Layer to connect them.
 */
module.exports = function withWearOS(config) {
  config = withSettingsGradle(config, (c) => {
    if (!c.modResults.contents.includes("':wear'")) {
      c.modResults.contents += `\ninclude ':wear'\nproject(':wear').projectDir = new File(rootProject.projectDir, '../targets/wear')\n`;
    }
    return c;
  });
  return withGradleProperties(config, (c) => {
    c.modResults = c.modResults.filter((p) => p.key !== 'wearApplicationId');
    c.modResults.push({ type: 'property', key: 'wearApplicationId', value: config.android.package });
    return c;
  });
};
