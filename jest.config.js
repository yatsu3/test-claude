const jestExpoPreset = require('jest-expo/jest-preset');

module.exports = {
  ...jestExpoPreset,
  // First test in a file pays for transforming react-native on a cold cache.
  testTimeout: 15000,
  transform: {
    ...jestExpoPreset.transform,
    '\\.sql$': '<rootDir>/jest.sqlTransformer.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|expo-router|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|standard-navigation|escape-string-regexp|query-string|invariant)',
  ],
};
