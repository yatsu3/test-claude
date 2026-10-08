module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // drizzle migrations import .sql files; inline them as strings at build time.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
