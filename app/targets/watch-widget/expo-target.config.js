/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch-widget',
  name: 'SkylineComplication',
  displayName: 'Skyline',
  deploymentTarget: '10.0',
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
