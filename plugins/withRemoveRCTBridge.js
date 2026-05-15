/**
 * Config plugin to patch AppDelegate (Swift/ObjC) for New Architecture compatibility.
 * Fixes "cannot find type 'RCTBridge' in scope" when New Arch is enabled (Expo issues #41189, #36595).
 * Use this when you set newArchEnabled: true; with newArchEnabled: false this plugin is a no-op.
 * Added to fix RCTBridge / New Arch incompatibility - Feb 2026
 */
const { withAppDelegate } = require('@expo/config-plugins');

module.exports = function withRemoveRCTBridge(config) {
  return withAppDelegate(config, (cfg) => {
    let { contents, language } = cfg.modResults;

    if (language === 'swift' || language === 'objc') {
      // Fix method signature: remove RCTBridge param type.
      // Use "func" not "override" so we don't get "method does not override any method from its superclass"
      // (New Arch template may not define this method on the superclass).
      contents = contents.replace(
        /override func sourceURL\(for bridge: RCTBridge\) -> URL\? \{/g,
        'func sourceURL(for _: Any) -> URL? {'
      );

      // Comment out / remove any direct RCTBridge variable declarations
      contents = contents.replace(
        /var bridge: RCTBridge\?[^;]*;/g,
        '// var bridge: RCTBridge? removed for New Arch compatibility'
      );

      // Safe bundle URL fallback if bridge.bundleURL was used
      contents = contents.replace(
        /bridge\.bundleURL/g,
        'Bundle.main.url(forResource: "main", withExtension: "jsbundle")'
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
