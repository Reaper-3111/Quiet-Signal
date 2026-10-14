/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'SkylineWidget',
  displayName: 'Skyline',
  // Interactive buttons (a tap that runs code without opening the app) need iOS 17.
  deploymentTarget: '17.0',
  // Same App Group as the app, so the widget can read the server list and token the app saves.
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
