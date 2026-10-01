const { withAndroidManifest } = require('expo/config-plugins');

// Lets the app detect WhatsApp / WhatsApp Business on Android 11+ (package visibility).
module.exports = function withWhatsAppQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    if (!Array.isArray(manifest.queries) || manifest.queries.length === 0) {
      manifest.queries = [{}];
    }
    const queries = manifest.queries[0];
    queries.package = queries.package || [];

    ['com.whatsapp', 'com.whatsapp.w4b'].forEach((name) => {
      const exists = queries.package.some((p) => p?.$?.['android:name'] === name);
      if (!exists) {
        queries.package.push({ $: { 'android:name': name } });
      }
    });

    return cfg;
  });
};