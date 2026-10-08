const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// drizzle migrations import .sql files.
config.resolver.sourceExts.push('sql');

module.exports = config;
