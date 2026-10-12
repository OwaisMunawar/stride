// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The demo replays a bundled GPX file; Metro has to treat it as an asset.
config.resolver.assetExts.push('gpx');

module.exports = config;
