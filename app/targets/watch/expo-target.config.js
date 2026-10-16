/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',
  name: 'SkylineWatch',
  displayName: 'Skyline',
  icon: '../../assets/icon.png',
  deploymentTarget: '10.0',
  // Shared on the watch with the complication. (App Groups do not sync between phone and watch;
  // the phone sends the config over WatchConnectivity, modules/watch-link.)
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
